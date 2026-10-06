CREATE TABLE "match_commands" (
	"match_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"player" smallint NOT NULL,
	"command" jsonb NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_commands_match_id_seq_pk" PRIMARY KEY("match_id","seq")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" varchar(6) NOT NULL,
	"status" text NOT NULL,
	"seed" integer NOT NULL,
	"names" jsonb NOT NULL,
	"token_hashes" jsonb NOT NULL,
	"state" jsonb NOT NULL,
	"version" integer NOT NULL,
	"winner" smallint,
	"end_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "match_commands" ADD CONSTRAINT "match_commands_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "matches_status_idx" ON "matches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "matches_updated_at_idx" ON "matches" USING btree ("updated_at");