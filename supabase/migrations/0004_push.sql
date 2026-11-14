-- Momentum: Zeitplaene fuer Push-Benachrichtigungen
-- Kann gefahrlos erneut ausgefuehrt werden.

-- Jede volle Stunde pruefen, was faellig ist. Die Function schaut selbst auf die
-- Berliner Uhrzeit (9 Uhr Countdown, 19 Uhr Wochenrueckblick, 20 Uhr Abend-Check).
select cron.schedule('momentum-send-push', '0 * * * *', $$select private.call_edge_function('send-push')$$);

-- Wochenrueckblick 10 Minuten frueher erstellen (Sonntag 18:50 Berliner Zeit),
-- damit er zur Benachrichtigung um 19:00 fertig ist. Ersetzt den Zeitplan aus 0003.
select cron.schedule('momentum-weekly-review', '50 16,17 * * 0', $$select private.call_edge_function('weekly-review')$$);
