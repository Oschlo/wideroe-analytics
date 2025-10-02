'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface RegressionData {
  date: string;
  region: string;
  // Weather predictors
  avg_temp: number;
  precip_mm: number;
  wind_mps: number;
  cold_shock: boolean;
  wind_shift: boolean;
  // Health predictors
  vaccinations: number;
  // Economic predictors
  cpi: number;
  cpi_change: number;
}

interface VariableSummary {
  name: string;
  type: 'continuous' | 'binary';
  mean: number;
  std: number;
  min: number;
  max: number;
  count: number;
}

export default function RegressionExplorerPage() {
  const [data, setData] = useState<RegressionData[]>([]);
  const [variables, setVariables] = useState<VariableSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVars, setSelectedVars] = useState<string[]>(['cold_shock', 'vaccinations', 'cpi_change']);

  const supabase = createClient();

  useEffect(() => {
    fetchRegressionData();
  }, []);

  const fetchRegressionData = async () => {
    setLoading(true);

    // This would join weather, health, and economic data
    // For now, we'll show the structure and dummy calculation

    // In production, this would be a complex query joining:
    // fact_weather_day + fact_health_signal_week + fact_macro_month
    // by region and time period

    // For demonstration, calculate variable summaries
    const vars: VariableSummary[] = [
      {
        name: 'avg_temp',
        type: 'continuous',
        mean: -2.5,
        std: 8.3,
        min: -25.4,
        max: 18.2,
        count: 450
      },
      {
        name: 'precip_mm',
        type: 'continuous',
        mean: 3.2,
        std: 5.1,
        min: 0,
        max: 42.5,
        count: 450
      },
      {
        name: 'wind_mps',
        type: 'continuous',
        mean: 5.8,
        std: 3.2,
        min: 0.5,
        max: 18.7,
        count: 450
      },
      {
        name: 'cold_shock',
        type: 'binary',
        mean: 0.067, // 6.7% of days
        std: 0.25,
        min: 0,
        max: 1,
        count: 450
      },
      {
        name: 'wind_shift',
        type: 'binary',
        mean: 0.044, // 4.4% of days
        std: 0.21,
        min: 0,
        max: 1,
        count: 450
      },
      {
        name: 'vaccinations',
        type: 'continuous',
        mean: 1245,
        std: 2150,
        min: 0,
        max: 7470,
        count: 36
      },
      {
        name: 'cpi',
        type: 'continuous',
        mean: 138.2,
        std: 0.6,
        min: 137.8,
        max: 138.9,
        count: 3
      },
      {
        name: 'cpi_change',
        type: 'continuous',
        mean: 0.26,
        std: 0.71,
        min: -0.65,
        max: 0.80,
        count: 3
      }
    ];

    setVariables(vars);
    setLoading(false);
  };

  const toggleVariable = (varName: string) => {
    setSelectedVars(prev =>
      prev.includes(varName)
        ? prev.filter(v => v !== varName)
        : [...prev, varName]
    );
  };

  const getVariableCategory = (varName: string): string => {
    if (['avg_temp', 'precip_mm', 'wind_mps', 'cold_shock', 'wind_shift'].includes(varName)) {
      return 'Weather';
    }
    if (['vaccinations'].includes(varName)) {
      return 'Health';
    }
    return 'Economic';
  };

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'Weather': return 'blue';
      case 'Health': return 'green';
      case 'Economic': return 'orange';
      default: return 'gray';
    }
  };

  const generateRCode = (): string => {
    const predictors = selectedVars.join(' + ');
    return `# R Code for Regression Model
library(tidyverse)

# Load data from Supabase
data <- read_csv("regression_data.csv")

# Fit linear regression model
model <- lm(Y ~ ${predictors}, data = data)

# View results
summary(model)

# Check assumptions
plot(model)

# ANOVA table
anova(model)

# Confidence intervals
confint(model)`;
  };

  const generatePythonCode = (): string => {
    const predictors = selectedVars.map(v => `'${v}'`).join(', ');
    return `# Python Code for Regression Model
import pandas as pd
import statsmodels.api as sm
from supabase import create_client

# Load data from Supabase
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
data = supabase.table('regression_view').select('*').execute()
df = pd.DataFrame(data.data)

# Prepare variables
X = df[[${predictors}]]
y = df['Y']

# Add constant for intercept
X = sm.add_constant(X)

# Fit OLS regression
model = sm.OLS(y, X).fit()

# View results
print(model.summary())

# Diagnostics
from statsmodels.stats.outliers_influence import variance_inflation_factor
vif = pd.DataFrame()
vif["Variable"] = X.columns
vif["VIF"] = [variance_inflation_factor(X.values, i) for i in range(X.shape[1])]
print(vif)`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-8"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Regression Explorer
          </h1>
          <p className="text-gray-600">
            Build multi-variate regression models with weather, health, and economic data
          </p>
        </div>

        {/* Variable Selection */}
        <div className="bg-white rounded-lg border border-gray-200 mb-8 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Select Independent Variables (Predictors)
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Choose variables to include in your regression model. Selected: {selectedVars.length}
          </p>

          <div className="space-y-4">
            {/* Weather Variables */}
            <div>
              <h3 className="text-sm font-medium text-blue-900 mb-2">
                🌡️ Weather Variables
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {variables.filter(v => getVariableCategory(v.name) === 'Weather').map(variable => (
                  <button
                    key={variable.name}
                    onClick={() => toggleVariable(variable.name)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      selectedVars.includes(variable.name)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-blue-300'
                    }`}
                  >
                    <div className="font-medium text-sm text-gray-900">{variable.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{variable.type}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      μ={variable.mean.toFixed(2)}, σ={variable.std.toFixed(2)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Health Variables */}
            <div>
              <h3 className="text-sm font-medium text-green-900 mb-2">
                💉 Health Variables
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {variables.filter(v => getVariableCategory(v.name) === 'Health').map(variable => (
                  <button
                    key={variable.name}
                    onClick={() => toggleVariable(variable.name)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      selectedVars.includes(variable.name)
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 bg-white hover:border-green-300'
                    }`}
                  >
                    <div className="font-medium text-sm text-gray-900">{variable.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{variable.type}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      μ={variable.mean.toFixed(0)}, σ={variable.std.toFixed(0)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Economic Variables */}
            <div>
              <h3 className="text-sm font-medium text-orange-900 mb-2">
                📈 Economic Variables
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {variables.filter(v => getVariableCategory(v.name) === 'Economic').map(variable => (
                  <button
                    key={variable.name}
                    onClick={() => toggleVariable(variable.name)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      selectedVars.includes(variable.name)
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 bg-white hover:border-orange-300'
                    }`}
                  >
                    <div className="font-medium text-sm text-gray-900">{variable.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{variable.type}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      μ={variable.mean.toFixed(2)}, σ={variable.std.toFixed(2)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Model Specification */}
        <div className="bg-white rounded-lg border border-gray-200 mb-8 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Model Specification
          </h2>
          <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm">
            <div className="text-gray-700">
              Y = β₀ + {selectedVars.map((v, i) => `β${i+1}·${v}`).join(' + ')} + ε
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            <p><strong>Where:</strong></p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li><code>Y</code> = Dependent variable (e.g., absence rate, illness cases)</li>
              <li><code>β₀</code> = Intercept</li>
              {selectedVars.map((v, i) => (
                <li key={v}><code>β{i+1}</code> = Coefficient for {v}</li>
              ))}
              <li><code>ε</code> = Error term</li>
            </ul>
          </div>
        </div>

        {/* Code Generation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* R Code */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">R Code</h3>
              <button
                onClick={() => navigator.clipboard.writeText(generateRCode())}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Copy
              </button>
            </div>
            <pre className="bg-gray-50 rounded p-4 text-xs overflow-x-auto">
              <code>{generateRCode()}</code>
            </pre>
          </div>

          {/* Python Code */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Python Code</h3>
              <button
                onClick={() => navigator.clipboard.writeText(generatePythonCode())}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                Copy
              </button>
            </div>
            <pre className="bg-gray-50 rounded p-4 text-xs overflow-x-auto">
              <code>{generatePythonCode()}</code>
            </pre>
          </div>
        </div>

        {/* Regression Assumptions */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Regression Assumptions Checklist
          </h2>
          <div className="space-y-3">
            <div className="flex items-start">
              <input type="checkbox" className="mt-1 mr-3" />
              <div>
                <div className="font-medium text-gray-900">1. Linearity</div>
                <div className="text-sm text-gray-600">
                  Relationship between X and Y is linear. Check with scatter plots and residual plots.
                </div>
              </div>
            </div>
            <div className="flex items-start">
              <input type="checkbox" className="mt-1 mr-3" />
              <div>
                <div className="font-medium text-gray-900">2. Independence</div>
                <div className="text-sm text-gray-600">
                  Observations are independent. For time series, consider autocorrelation (Durbin-Watson test).
                </div>
              </div>
            </div>
            <div className="flex items-start">
              <input type="checkbox" className="mt-1 mr-3" />
              <div>
                <div className="font-medium text-gray-900">3. Homoscedasticity</div>
                <div className="text-sm text-gray-600">
                  Constant variance of residuals. Check with residual vs fitted plots, Breusch-Pagan test.
                </div>
              </div>
            </div>
            <div className="flex items-start">
              <input type="checkbox" className="mt-1 mr-3" />
              <div>
                <div className="font-medium text-gray-900">4. Normality</div>
                <div className="text-sm text-gray-600">
                  Residuals are normally distributed. Check with Q-Q plots, Shapiro-Wilk test.
                </div>
              </div>
            </div>
            <div className="flex items-start">
              <input type="checkbox" className="mt-1 mr-3" />
              <div>
                <div className="font-medium text-gray-900">5. No Multicollinearity</div>
                <div className="text-sm text-gray-600">
                  Independent variables are not highly correlated. Check VIF (Variance Inflation Factor) &lt; 10.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Techniques */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Advanced Regression Techniques
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-purple-50 rounded-lg">
              <h3 className="font-medium text-purple-900 mb-2">Fixed Effects Models</h3>
              <p className="text-sm text-purple-800">
                Control for time-invariant regional differences by including region dummy variables
                or using panel data methods (LSDV, within estimator).
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">Time Lags</h3>
              <p className="text-sm text-blue-800">
                Include lagged predictors (t-1, t-2, t-7) to capture delayed effects. Example:
                vaccinations lag 2-4 weeks before affecting illness rates.
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <h3 className="font-medium text-green-900 mb-2">Interaction Terms</h3>
              <p className="text-sm text-green-800">
                Test if effects vary by context. Example: cold_shock × region to see if cold
                shocks have different impacts in northern vs southern regions.
              </p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <h3 className="font-medium text-orange-900 mb-2">Robust Standard Errors</h3>
              <p className="text-sm text-orange-800">
                Use Huber-White robust standard errors to handle heteroscedasticity without
                transforming data. Clustered SEs for panel data.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
