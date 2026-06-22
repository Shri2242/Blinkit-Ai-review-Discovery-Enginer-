CREATE TABLE "collector_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"status" varchar(20) NOT NULL,
	"reviews_fetched" integer DEFAULT 0,
	"reviews_new" integer DEFAULT 0,
	"reviews_duplicate" integer DEFAULT 0,
	"duration_ms" integer,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "collector_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"source_type" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"config" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"schedule" varchar(50) DEFAULT '0 9 * * *' NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_run_status" varchar(20),
	"last_run_count" integer DEFAULT 0,
	"total_collected" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collector_logs" ADD CONSTRAINT "collector_logs_source_id_collector_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."collector_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collector_sources" ADD CONSTRAINT "collector_sources_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collector_sources_project_idx" ON "collector_sources" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "collector_sources_enabled_idx" ON "collector_sources" USING btree ("enabled");