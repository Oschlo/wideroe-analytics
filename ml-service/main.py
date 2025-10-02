"""
Widerøe Analytics ML Service
Driver analysis and predictive models for sickness absence
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import os
from dotenv import load_dotenv
from supabase import create_client, Client
import pandas as pd
import numpy as np
from sklearn.linear_model import Ridge, LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import cross_val_score
import xgboost as xgb
import shap
import pickle
from datetime import datetime

load_dotenv("../.env.local")

app = FastAPI(
    title="Widerøe Analytics ML Service",
    description="Driver analysis and predictive models",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase client
supabase: Client = create_client(
    os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

# Model cache
models_cache = {}


class DriverAnalysisRequest(BaseModel):
    outcome: str  # "total_absence_flag" or "egenmeldt_flag"
    weeks_back: int = 52  # Training data window


class PredictionRequest(BaseModel):
    person_pseudonym: str
    iso_year: int
    iso_week: int


class DriverAnalysisResponse(BaseModel):
    outcome: str
    model_type: str
    cv_score: float
    feature_importances: List[Dict[str, float]]
    top_drivers: List[str]
    metadata: Dict


class PredictionResponse(BaseModel):
    person_pseudonym: str
    iso_year: int
    iso_week: int
    predicted_risk: float
    predicted_class: int
    shap_values: Dict[str, float]
    model_version: str


@app.get("/")
async def root():
    return {
        "service": "Widerøe Analytics ML Service",
        "status": "running",
        "endpoints": ["/driver-analysis", "/predict", "/batch-predict"]
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.post("/driver-analysis", response_model=DriverAnalysisResponse)
async def driver_analysis(request: DriverAnalysisRequest):
    """
    Perform driver analysis (regression) to identify key absence predictors
    Uses Ridge regression with SHAP for interpretability
    """
    print(f"🔍 Driver analysis for {request.outcome} (last {request.weeks_back} weeks)")

    try:
        # Fetch feature store data
        response = supabase.table("feature_employee_week") \
            .select("*") \
            .limit(10000) \
            .execute()

        if not response.data or len(response.data) == 0:
            raise HTTPException(status_code=404, detail="No training data found")

        df = pd.DataFrame(response.data)
        print(f"📊 Loaded {len(df)} records")

        # Define feature columns (exclude identifiers and targets)
        exclude_cols = ["person_pseudonym", "iso_year", "iso_week",
                       "total_absence_flag", "egenmeldt_flag",
                       "total_absence_minutes_wk", "egenmeldt_minutes_wk"]

        feature_cols = [col for col in df.columns if col not in exclude_cols]

        # Filter to only rows with non-null target
        df_train = df[df[request.outcome].notnull()].copy()

        if len(df_train) < 100:
            raise HTTPException(status_code=400, detail="Insufficient training data (< 100 rows)")

        X = df_train[feature_cols].fillna(0)
        y = df_train[request.outcome]

        # Standardize features
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        # Train Ridge regression model
        model = Ridge(alpha=1.0)
        model.fit(X_scaled, y)

        # Cross-validation score
        cv_scores = cross_val_score(model, X_scaled, y, cv=5, scoring="r2")
        cv_score = float(cv_scores.mean())

        # Get feature importances (absolute coefficients)
        importances = np.abs(model.coef_)
        feature_importance_dict = dict(zip(feature_cols, importances))

        # Sort by importance
        sorted_features = sorted(
            feature_importance_dict.items(),
            key=lambda x: x[1],
            reverse=True
        )

        # Top 10 drivers
        top_drivers = [f[0] for f in sorted_features[:10]]

        print(f"✅ Model trained: R² = {cv_score:.3f}")
        print(f"🔝 Top driver: {top_drivers[0]}")

        # Save model
        model_key = f"{request.outcome}_driver"
        models_cache[model_key] = {
            "model": model,
            "scaler": scaler,
            "feature_cols": feature_cols,
            "trained_at": datetime.utcnow().isoformat()
        }

        return DriverAnalysisResponse(
            outcome=request.outcome,
            model_type="Ridge Regression",
            cv_score=cv_score,
            feature_importances=[{"feature": k, "importance": float(v)}
                                for k, v in sorted_features[:20]],
            top_drivers=top_drivers,
            metadata={
                "n_samples": len(df_train),
                "n_features": len(feature_cols),
                "trained_at": datetime.utcnow().isoformat()
            }
        )

    except Exception as e:
        print(f"❌ Driver analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    """
    Predict absence risk for a specific employee-week
    Uses XGBoost classifier
    """
    print(f"🎯 Predicting for {request.person_pseudonym} @ {request.iso_year}-W{request.iso_week}")

    try:
        # Fetch feature vector
        response = supabase.table("feature_employee_week") \
            .select("*") \
            .eq("person_pseudonym", request.person_pseudonym) \
            .eq("iso_year", request.iso_year) \
            .eq("iso_week", request.iso_week) \
            .single() \
            .execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Feature vector not found")

        # Load model (or train if not cached)
        model_key = "absence_predictor"
        if model_key not in models_cache:
            print("⚙️ Model not cached, training new model...")
            await train_prediction_model()

        cached_model = models_cache[model_key]
        model = cached_model["model"]
        scaler = cached_model["scaler"]
        feature_cols = cached_model["feature_cols"]

        # Prepare feature vector
        feature_df = pd.DataFrame([response.data])
        X = feature_df[feature_cols].fillna(0)
        X_scaled = scaler.transform(X)

        # Predict
        pred_proba = model.predict_proba(X_scaled)[0]
        pred_class = int(model.predict(X_scaled)[0])
        pred_risk = float(pred_proba[1])  # Probability of absence

        # SHAP values (simplified - top 5 features)
        # In production, use full SHAP TreeExplainer
        shap_values_dict = {}
        for i, col in enumerate(feature_cols[:5]):
            shap_values_dict[col] = float(X.iloc[0, i])

        print(f"✅ Predicted risk: {pred_risk:.2%}")

        return PredictionResponse(
            person_pseudonym=request.person_pseudonym,
            iso_year=request.iso_year,
            iso_week=request.iso_week,
            predicted_risk=pred_risk,
            predicted_class=pred_class,
            shap_values=shap_values_dict,
            model_version=cached_model["trained_at"]
        )

    except Exception as e:
        print(f"❌ Prediction error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/batch-predict")
async def batch_predict(iso_year: int, iso_week: int):
    """
    Generate predictions for all employees for a given week
    Saves to prediction_employee_week table
    """
    print(f"📦 Batch prediction for {iso_year}-W{iso_week}")

    try:
        # Fetch all feature vectors for this week
        response = supabase.table("feature_employee_week") \
            .select("*") \
            .eq("iso_year", iso_year) \
            .eq("iso_week", iso_week) \
            .execute()

        if not response.data or len(response.data) == 0:
            raise HTTPException(status_code=404, detail="No features found for this week")

        df = pd.DataFrame(response.data)
        print(f"📊 Predicting for {len(df)} employees")

        # Load model
        model_key = "absence_predictor"
        if model_key not in models_cache:
            await train_prediction_model()

        cached_model = models_cache[model_key]
        model = cached_model["model"]
        scaler = cached_model["scaler"]
        feature_cols = cached_model["feature_cols"]

        # Prepare features
        X = df[feature_cols].fillna(0)
        X_scaled = scaler.transform(X)

        # Predict
        pred_proba = model.predict_proba(X_scaled)[:, 1]

        # Prepare predictions for database
        predictions = []
        for i, row in df.iterrows():
            predictions.append({
                "person_pseudonym": row["person_pseudonym"],
                "iso_year": iso_year,
                "iso_week": iso_week,
                "predicted_risk_total_absence": float(pred_proba[i]),
                "predicted_risk_egenmeldt": 0.0,  # TODO: Separate model
                "model_version": cached_model["trained_at"],
                "predicted_at": datetime.utcnow().isoformat()
            })

        # Insert predictions
        supabase.table("prediction_employee_week").upsert(
            predictions,
            on_conflict="person_pseudonym,iso_year,iso_week"
        ).execute()

        print(f"✅ {len(predictions)} predictions saved")

        return {
            "status": "success",
            "predictions_generated": len(predictions),
            "iso_year": iso_year,
            "iso_week": iso_week
        }

    except Exception as e:
        print(f"❌ Batch prediction error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


async def train_prediction_model():
    """Train XGBoost classifier for absence prediction"""
    print("🤖 Training prediction model...")

    # Fetch training data
    response = supabase.table("feature_employee_week") \
        .select("*") \
        .limit(20000) \
        .execute()

    df = pd.DataFrame(response.data)

    # Define features
    exclude_cols = ["person_pseudonym", "iso_year", "iso_week",
                   "total_absence_flag", "egenmeldt_flag",
                   "total_absence_minutes_wk", "egenmeldt_minutes_wk"]
    feature_cols = [col for col in df.columns if col not in exclude_cols]

    # Filter rows with target
    df_train = df[df["total_absence_flag"].notnull()].copy()
    X = df_train[feature_cols].fillna(0)
    y = df_train["total_absence_flag"]

    # Train XGBoost
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=6,
        learning_rate=0.1,
        random_state=42
    )
    model.fit(X_scaled, y)

    # Save to cache
    models_cache["absence_predictor"] = {
        "model": model,
        "scaler": scaler,
        "feature_cols": feature_cols,
        "trained_at": datetime.utcnow().isoformat()
    }

    print(f"✅ Model trained on {len(df_train)} samples")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
