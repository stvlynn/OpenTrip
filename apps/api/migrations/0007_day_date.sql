-- Store itinerary day dates as structured ISO values.
-- `date_label` remains as a legacy fallback for imported descriptive labels.

ALTER TABLE trip_days
  ADD COLUMN IF NOT EXISTS date text NOT NULL DEFAULT '';
