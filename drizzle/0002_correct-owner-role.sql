DELETE FROM `team_members`
WHERE `user_id` = 'local-owner'
  AND `email` = 'sites-screenshot-service-noreply@chatgpt.com';
--> statement-breakpoint
UPDATE `team_members`
SET `role` = 'manager'
WHERE `email` = 'jasonr@oneplacec.com';
