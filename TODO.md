# Approvals Plant Filter Fix Plan - DONE

## Problem
Approvals page plant filter dropdown only shows "Tea Plant" but "Salt Plant" and "DASNA Plant" are missing. This happens because:
- In the database, only "Tea Plant" has an explicit `id` field
- "Salt Plant" and "DASNA Plant" only have MongoDB `_id` (no explicit `id`)
- The `authorizedPlants` filter uses `p.id` which is `undefined` for Salt & DASNA
- When a user's `plantIds` contain the `_id` values, the `.includes(p.id)` check fails

## Changes Completed

### ✅ `src/app/dashboard/approvals/page.tsx`

**Fix A:** `authorizedPlants` filter - Now checks both `p.id` AND `(p as any)._id`
- Old: `return plants.filter(p => userAssignedPlantIds.includes(p.id));`
- New: `return plants.filter(p => userAssignedPlantIds.includes(p.id) || userAssignedPlantIds.includes((p as any)._id));`

**Fix B:** Plant filter dropdown `SelectItem` key - Now uses fallback `_id`
- Old: `key={p.id}` 
- New: `key={p.id || (p as any)._id}`

## Testing
- ✅ Login as SUPER_ADMIN/HR user with access to all plants
- ✅ Open Approvals page
- ✅ Verify plant filter dropdown shows "Tea Plant", "Salt Plant", and "DASNA Plant"
- ✅ Verify filtering by each plant works correctly

