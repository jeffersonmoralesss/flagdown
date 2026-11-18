// Every database and storage call the driver app makes is in this file, so you can see in one place
// exactly what it reads and writes. The database's own rules (row level security and the
// drivers_guard trigger) decide what each call may do; this file never has to trust itself.
import { supabase } from './supabase';

// Turns Supabase's { data, error } into "return data, or throw an error with a readable message",
// so screens can use a plain try/catch.
function unwrap({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

// ---------- Driver profile ----------

// The signed-in user's driver row, or null if they haven't filled in their details yet.
export async function getMyDriver(userId) {
  return unwrap(await supabase.from('drivers').select('*').eq('user_id', userId).maybeSingle());
}

// Creates or updates the driver row and returns it as saved. The database ignores any attempt to
// set status or subscription here, and once approved it keeps the cab details as they were.
export async function saveDriver(fields, existingId) {
  const query = existingId
    ? supabase.from('drivers').update(fields).eq('id', existingId)
    : supabase.from('drivers').insert(fields);
  return unwrap(await query.select().single());
}

// Switches Available on or off. Returns what the database actually stored: if the driver isn't
// approved or their subscription isn't working, the database forces it back to false.
export async function setAvailable(driverId, available) {
  const row = unwrap(
    await supabase.from('drivers').update({ is_available: available }).eq('id', driverId).select('is_available').single(),
  );
  return row.is_available;
}

// ---------- Documents ----------

export async function listDocuments(driverId) {
  return unwrap(
    await supabase.from('driver_documents').select('*').eq('driver_id', driverId).order('created_at', { ascending: false }),
  );
}

// Uploads a picked file to private storage, then records it in driver_documents.
export async function uploadDocument({ driverId, userId, kind, file, expiresOn }) {
  const ext = (file.name?.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf';
  // The first folder must be the user's own id: the storage rules only allow uploads there.
  const path = `${userId}/${kind}-${Date.now()}.${ext}`;

  // Read the picked file as raw bytes. Works the same for a phone file and a browser file.
  const bytes = await fetch(file.uri).then((res) => res.arrayBuffer());

  unwrap(
    await supabase.storage.from('driver-docs').upload(path, bytes, {
      contentType: file.mimeType || 'application/octet-stream',
      upsert: false,
    }),
  );

  return unwrap(
    await supabase
      .from('driver_documents')
      .insert({ driver_id: driverId, kind, file_path: path, expires_on: expiresOn })
      .select()
      .single(),
  );
}

// ---------- Position ----------

// Saves the cab's current position. "Upsert" = insert the first time, update after that, because
// driver_positions keeps exactly one row per driver. The database stamps the time itself.
export async function sendPosition(driverId, { latitude, longitude, accuracy, heading }) {
  unwrap(
    await supabase.from('driver_positions').upsert(
      {
        driver_id: driverId,
        lat: latitude,
        lng: longitude,
        accuracy_m: accuracy == null ? null : Math.max(0, accuracy),
        heading,
      },
      { onConflict: 'driver_id' },
    ),
  );
}
