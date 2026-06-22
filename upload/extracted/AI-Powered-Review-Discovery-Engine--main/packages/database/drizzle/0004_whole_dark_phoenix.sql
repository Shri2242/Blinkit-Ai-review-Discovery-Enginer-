CREATE TABLE "review_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"embedding_model" varchar(255) NOT NULL,
	"dimensions" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_embeddings_review_id_unique" UNIQUE("review_id")
);
--> statement-breakpoint
ALTER TABLE "review_embeddings" ADD CONSTRAINT "review_embeddings_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_embeddings" ADD CONSTRAINT "review_embeddings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_embeddings_project_idx" ON "review_embeddings" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "review_embeddings_review_idx" ON "review_embeddings" USING btree ("review_id");--> statement-breakpoint
ALTER TABLE "review_embeddings" ADD COLUMN "embedding" vector(384);--> statement-breakpoint
-- CREATE INDEX "review_embeddings_vector_idx" ON "review_embeddings" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);