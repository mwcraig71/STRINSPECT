import { pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { customType } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const sessionPhotosTable = pgTable(
  "session_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    structureNumber: text("structure_number").notNull(),
    photoId: text("photo_id").notNull(),
    photoData: bytea("photo_data").notNull(),
    mimeType: text("mime_type").notNull().default("image/jpeg"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_session_photos_sn_pid").on(t.structureNumber, t.photoId)],
);
