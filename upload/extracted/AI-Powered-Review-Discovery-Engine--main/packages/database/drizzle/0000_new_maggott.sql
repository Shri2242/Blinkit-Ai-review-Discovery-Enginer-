CREATE TYPE "public"."user_role" AS ENUM('admin', 'analyst', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."priority_level" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."processing_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."review_source" AS ENUM('csv_upload', 'app_store', 'google_play', 'g2', 'trustpilot', 'manual');--> statement-breakpoint
CREATE TYPE "public"."sentiment_type" AS ENUM('positive', 'negative', 'neutral', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."theme_category" AS ENUM('payment', 'performance', 'usability', 'onboarding', 'features', 'support', 'pricing', 'security', 'reliability', 'content');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"password_hash" varchar(255),
	"role" "user_role" DEFAULT 'viewer' NOT NULL,
	"avatar_url" varchar(512),
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "user_role" DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"app_store_url" text,
	"google_play_url" text,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"source" "review_source" NOT NULL,
	"source_review_id" varchar(255),
	"review_text" text NOT NULL,
	"review_title" text,
	"rating" smallint,
	"author_name" varchar(255),
	"review_date" timestamp with time zone NOT NULL,
	"language" varchar(10) DEFAULT 'en' NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"processing_status" "processing_status" DEFAULT 'pending' NOT NULL,
	"processed_at" timestamp with time zone,
	"processing_error" text,
	"retry_count" smallint DEFAULT 0 NOT NULL,
	"sentiment" "sentiment_type",
	"sentiment_confidence" real,
	"theme" "theme_category",
	"sub_theme" varchar(255),
	"priority" "priority_level",
	"priority_reason" text,
	"key_phrases" text[],
	"ai_summary" text,
	"is_bug" boolean DEFAULT false NOT NULL,
	"is_feature_request" boolean DEFAULT false NOT NULL,
	"actionable" boolean DEFAULT false NOT NULL,
	"embedding_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upload_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"filename" varchar(255) NOT NULL,
	"source" "review_source" DEFAULT 'csv_upload' NOT NULL,
	"file_url" text,
	"total_rows" smallint DEFAULT 0 NOT NULL,
	"processed_rows" smallint DEFAULT 0 NOT NULL,
	"failed_rows" smallint DEFAULT 0 NOT NULL,
	"status" "processing_status" DEFAULT 'pending' NOT NULL,
	"error_log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"insight_type" varchar(50) NOT NULL,
	"theme" "theme_category",
	"title" varchar(500) NOT NULL,
	"summary" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"severity" "priority_level",
	"review_count" integer DEFAULT 0 NOT NULL,
	"date_range_start" timestamp with time zone,
	"date_range_end" timestamp with time zone,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_dismissed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"date" date NOT NULL,
	"total_reviews" integer DEFAULT 0 NOT NULL,
	"avg_rating" real,
	"sentiment_positive" integer DEFAULT 0 NOT NULL,
	"sentiment_negative" integer DEFAULT 0 NOT NULL,
	"sentiment_neutral" integer DEFAULT 0 NOT NULL,
	"sentiment_mixed" integer DEFAULT 0 NOT NULL,
	"top_themes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"top_issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"source_reviews" jsonb,
	"token_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"user_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50),
	"entity_id" uuid,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_batches" ADD CONSTRAINT "upload_batches_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_batches" ADD CONSTRAINT "upload_batches_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_daily" ADD CONSTRAINT "analytics_daily_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_members_project_user_idx" ON "project_members" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_project_source_id_idx" ON "reviews" USING btree ("project_id","source","source_review_id");--> statement-breakpoint
CREATE INDEX "reviews_project_idx" ON "reviews" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "reviews_project_sentiment_idx" ON "reviews" USING btree ("project_id","sentiment");--> statement-breakpoint
CREATE INDEX "reviews_project_theme_idx" ON "reviews" USING btree ("project_id","theme");--> statement-breakpoint
CREATE INDEX "reviews_project_priority_idx" ON "reviews" USING btree ("project_id","priority");--> statement-breakpoint
CREATE INDEX "reviews_project_date_idx" ON "reviews" USING btree ("project_id","review_date");--> statement-breakpoint
CREATE INDEX "reviews_project_status_idx" ON "reviews" USING btree ("project_id","processing_status");--> statement-breakpoint
CREATE INDEX "reviews_content_hash_idx" ON "reviews" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "upload_batches_project_idx" ON "upload_batches" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "upload_batches_status_idx" ON "upload_batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "insights_project_idx" ON "insights" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "insights_project_type_idx" ON "insights" USING btree ("project_id","insight_type");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_daily_project_date_idx" ON "analytics_daily" USING btree ("project_id","date");--> statement-breakpoint
CREATE INDEX "analytics_daily_project_idx" ON "analytics_daily" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "chat_messages_session_idx" ON "chat_messages" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_log_project_date_idx" ON "activity_log" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_log_project_user_idx" ON "activity_log" USING btree ("project_id","user_id");