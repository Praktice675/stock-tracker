-- migration: 007_clean_zero_snapshots.sql
--
-- Remove portfolio_snapshots rows where total_value was recorded as 0 or
-- near-zero. These rows came from transient Yahoo failures during the
-- snapshot POST — when a quote fetch returned null, the previous version
-- of the route fell back to 0, polluting the time series. The POST route
-- now refuses to insert when any quote is missing, so this clean-up only
-- needs to run once against historical data.

delete from public.portfolio_snapshots where total_value < 1;
