## Supabase Storage image deletion checklist

Use this flow whenever a plate photo (or any uploaded image) needs to be removed from Supabase Storage. It mirrors the behaviour implemented in `NumberPlatesManager`.

1. **Persist (or derive) the storage key**  
   - Best practice is to store the exact `path` you passed to `upload` (e.g. `dealers/{dealershipId}/plate_123.jpeg`) alongside the record so deletions never depend on URL parsing.  
   - Our current implementation keeps only the public URL, so we derive the key on the fly with `resolveStoragePathFromUrl`. Consider backfilling a `storage_path` column when we revisit the schema.

2. **Resolve the key before deleting**  
   - If legacy rows only have a public URL, derive the key by removing `/storage/v1/object/public/{bucket}/` and decoding the remainder.  
   - Example helper:
     ```ts
     const resolveStoragePathFromUrl = (publicUrl: string, bucket: string) => {
       const { pathname } = new URL(publicUrl)
       const prefix = `/storage/v1/object/public/${bucket}/`
       return pathname.startsWith(prefix) ? decodeURIComponent(pathname.slice(prefix.length)) : null
     }
     ```

3. **Call `remove` with the key**  
   ```ts
   const { error } = await supabase.storage.from(bucket).remove([storageKey])
   if (error) throw error
   ```
   - `remove` returns an array containing the deleted objects when it succeeds. If the array is empty and no error is thrown, the key did not match an object.

4. **Ensure storage policies allow it**  
   - Storage uses Row Level Security. For client-side deletes you must permit `SELECT` and `DELETE` on `storage.objects` for the relevant users.  
   - A quick debugging step is to temporarily set the policy to `true` and confirm the call works, then scope it to `auth.uid()` or a similar condition.

5. **Prefer server-side deletion for stricter control**  
   - For privileged operations (e.g. admin-only cleanup) call `remove` from a Supabase Function or other server where the service role key is available.

Following these steps prevents orphaned files and avoids the “empty result” confusion caused by missing permissions or mismatched storage keys.
