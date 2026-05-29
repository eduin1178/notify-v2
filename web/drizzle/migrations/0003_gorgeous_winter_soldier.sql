CREATE TABLE "whatsapp_connection" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"kapso_customer_id" text NOT NULL,
	"setup_link_id" text,
	"phone_number_id" text,
	"business_account_id" text,
	"display_phone_number" text,
	"connection_type" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"connected_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_connection_org_phone_unique" UNIQUE("organization_id","phone_number_id")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_webhook_event" (
	"id" text PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"event" text NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_webhook_event_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "kapso_customer_id" text;--> statement-breakpoint
ALTER TABLE "whatsapp_connection" ADD CONSTRAINT "whatsapp_connection_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_kapso_customer_id_unique" UNIQUE("kapso_customer_id");