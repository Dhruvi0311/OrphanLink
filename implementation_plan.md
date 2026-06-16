# Integrate Proximity Calculation & Sorting

This plan outlines the steps to add basic zip-code or city-level distance calculation and proximity sorting for matched clinical trials.

## Goal Description
We will allow the user to input their location (e.g., Zip Code or City/State). The backend will extract trial facility locations from the ClinicalTrials.gov API, calculate the distance from the patient to the nearest trial site, and the frontend will allow users to toggle sorting between "Clinical Match Status" and "Proximity (Distance)".

## Proposed Changes

### Backend Updates
1. **Dependencies**:
   - Install `geopy` to handle geolocation (converting cities/zip codes to coordinates) and geodesic distance calculations.
   
2. **Endpoints (`main.py`)**:
   - Update the `/upload` endpoint to accept an optional `patient_location` field from the frontend FormData.

3. **Trial API & Distance Logic (`clinical_trials_api.py` & `agent_orchestrator.py`)**:
   - Update `clinical_trials_api.py` to extract `locations` (facilities, cities, states, zips) from the `contactsLocationsModule` of the study JSON.
   - During the evaluation phase (or a new post-processing step in LangGraph), resolve the user's location coordinates.
   - For each retrieved trial, resolve its facility locations to coordinates and calculate the minimum distance in miles. Add this `closest_facility` and `distance_miles` to the trial evaluation result object.

### Frontend Updates
1. **Document Ingestion (`dashboard-client.tsx`)**:
   - Add a text input field for "Patient Location (Zip Code or City)" in the Document Ingestion card alongside the file upload button.
   - Pass this location in the `FormData` to the `/upload` endpoint.
   
2. **Results Canvas (`dashboard-client.tsx`)**:
   - Add a sorting dropdown/toggle to the "Trial Evaluation Results" header:
     - **Sort by: Match Status** (Default: Matches first, Excluded last)
     - **Sort by: Proximity** (Closest trials first)
   - Display the distance and nearest facility in the trial card UI.

## User Review Required

> [!WARNING]
> Geocoding limits: We will use the free `Nominatim` geocoder provided by OpenStreetMap via the `geopy` library. It has a strict rate limit of 1 request per second. If a trial has dozens of locations, this could slow down the processing. I will mitigate this by implementing caching (storing city->coordinate mappings in memory) and only checking the first 5 locations per trial to keep the UX fast. Is this acceptable?

## Open Questions

> [!IMPORTANT]
> If a user *does not* provide a location, should we still calculate distances from a default location (e.g., New York), or just hide the distance/sorting feature for that specific run?
