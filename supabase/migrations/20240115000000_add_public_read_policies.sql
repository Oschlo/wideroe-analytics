-- Add public read access for admin pages
-- This allows the admin UI to display organizations without authentication

-- Allow public read access to organizations table
CREATE POLICY "Public can view organizations"
  ON organizations FOR SELECT
  USING (true);

-- Allow public read access to organization_integrations
CREATE POLICY "Public can view integrations"
  ON organization_integrations FOR SELECT
  USING (true);

-- Allow public read access to organization_locations
CREATE POLICY "Public can view locations"
  ON organization_locations FOR SELECT
  USING (true);
