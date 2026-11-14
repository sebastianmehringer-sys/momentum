-- Momentum: Wochenrueckblick jeden Sonntagabend
-- Kann gefahrlos erneut ausgefuehrt werden.

-- pg_cron rechnet in Weltzeit. 19 Uhr in Berlin ist 18 Uhr (Winter) bzw. 17 Uhr (Sommer)
-- Weltzeit. Deshalb zwei Laeufe; die Function prueft selbst, welcher der richtige ist.
select cron.schedule('momentum-weekly-review', '0 17,18 * * 0', $$select private.call_edge_function('weekly-review')$$);
