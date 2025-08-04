CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`thread_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `threads`(`thread_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `review_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`thread_id` text NOT NULL,
	`user_question` text NOT NULL,
	`original_response` text NOT NULL,
	`final_response` text NOT NULL,
	`action` text NOT NULL,
	`scores` text NOT NULL,
	`lowest_score_category` text NOT NULL,
	`lowest_score_value` integer NOT NULL,
	`issues` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subsidies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`jgrants_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`target_audience` text,
	`amount` text,
	`deadline` text,
	`requirements` text,
	`application_url` text,
	`ministry` text,
	`vector_store_id` text,
	`file_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `threads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`thread_id` text NOT NULL,
	`user_id` text,
	`metadata` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `validation_loops` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`thread_id` text NOT NULL,
	`user_question` text NOT NULL,
	`loop_number` integer NOT NULL,
	`review_scores` text NOT NULL,
	`lowest_score_category` text NOT NULL,
	`lowest_score_value` integer NOT NULL,
	`improvement_hints` text,
	`score_improvement` integer NOT NULL,
	`response` text NOT NULL,
	`action` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `validation_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`thread_id` text NOT NULL,
	`user_question` text NOT NULL,
	`initial_response` text NOT NULL,
	`final_response` text NOT NULL,
	`best_response` text NOT NULL,
	`total_loops` integer NOT NULL,
	`total_improvement` integer NOT NULL,
	`best_scores` text NOT NULL,
	`failure_patterns` text,
	`success_patterns` text,
	`duration` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subsidies_jgrants_id_unique` ON `subsidies` (`jgrants_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `threads_thread_id_unique` ON `threads` (`thread_id`);