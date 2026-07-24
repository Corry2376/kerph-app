-- Kerph demo/test data seed — populates cjstalcup@kerphplans.com's real account with fake,
-- clearly-labeled ([DEMO]) content across Workshop Planner (incl. Dust Collection), Project
-- Designer, Cut List Optimizer, Quote Builder, Portfolio, Shop Showcase, and My Tools — so the
-- account can be explored without building each area out by hand.
--
-- Run this whole script once in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Singleton tables (current_layouts, project_live_state, cutlist_live_parts, tool_status) use
-- ON CONFLICT upserts. Named-row tables (saved_layouts, saved_projects, quotes,
-- portfolio_projects, showcase_posts) are guarded with WHERE NOT EXISTS so this script is safe
-- to run more than once without creating duplicates.
--
-- To remove all of it later, search each of the tables below for rows whose name/title starts
-- with "[DEMO]" (or, for showcase_posts, whose tags include "demo") and delete them.

-- =====================================================================================
-- 1. WORKSHOP LAYOUT + DUST COLLECTION
--    Seeds both the live board (current_layouts, so it is what you see the moment you open
--    Workshop Planner) and a named entry in My Saved Layouts.
-- =====================================================================================

with target_user as (
    select id from auth.users where email = 'cjstalcup@kerphplans.com'
),
layout_data as (
    select '{
        "id": "demo-layout-1",
        "name": "[DEMO] Woodworking Shop w/ Dust Collection",
        "savedAt": "2026-07-23T12:00:00.000Z",
        "widthFeet": 24,
        "lengthFeet": 32,
        "ceilingHeightFt": 10,
        "scale": "1",
        "unitSystem": "imperial",
        "shopType": "woodworking",
        "shapeMode": "rectangle",
        "shapePoints": [],
        "tools": [
            { "label": "SawStop PCS175", "displayName": "SawStop PCS175", "displayDims": "36in x 62in", "left": 300, "top": 250, "width": 90, "height": 156, "rotation": 0, "cabType": null, "physicalHeight": "2.9", "mountHeightIn": null, "layer": "tools", "estCost": "4200", "clearanceCategory": "table-saw" },
            { "label": "Laguna 14BX", "displayName": "Laguna 14BX", "displayDims": "25in x 30in", "left": 550, "top": 250, "width": 63, "height": 75, "rotation": 0, "cabType": null, "physicalHeight": "5.8", "mountHeightIn": null, "layer": "tools", "estCost": "2800", "clearanceCategory": null },
            { "label": "Powermatic PJ882", "displayName": "Powermatic PJ882", "displayDims": "17in x 88in", "left": 40, "top": 40, "width": 42, "height": 219, "rotation": 0, "cabType": null, "physicalHeight": "3.0", "mountHeightIn": null, "layer": "tools", "estCost": "3400", "clearanceCategory": null },
            { "label": "DeWalt DW735X", "displayName": "DeWalt DW735X", "displayDims": "22in x 24in", "left": 40, "top": 290, "width": 54, "height": 60, "rotation": 0, "cabType": null, "physicalHeight": "1.8", "mountHeightIn": null, "layer": "tools", "estCost": "650", "clearanceCategory": null },
            { "label": "Husky 52in Mobile Workbench", "displayName": "Husky 52in Mobile Workbench", "displayDims": "52in x 25in", "left": 300, "top": 560, "width": 129, "height": 63, "rotation": 0, "cabType": null, "physicalHeight": "3.3", "mountHeightIn": null, "layer": "tools", "estCost": "450", "clearanceCategory": null },
            { "label": "Base Cabinet - 36in", "displayName": "Base Cabinet - 36in", "displayDims": "36in W x 24in D", "left": 550, "top": 560, "width": 90, "height": 60, "rotation": 0, "cabType": "base", "physicalHeight": "2.9", "mountHeightIn": null, "layer": "cabinets", "estCost": "320", "clearanceCategory": null },
            { "label": "Wall Cabinet - 30in", "displayName": "Wall Cabinet - 30in", "displayDims": "30in W x 12in D", "left": 550, "top": 470, "width": 75, "height": 30, "rotation": 0, "cabType": "wall", "physicalHeight": "2.5", "mountHeightIn": "54", "layer": "cabinets", "estCost": "260", "clearanceCategory": null },
            { "label": "JET DC-1100VX", "displayName": "JET DC-1100VX", "displayDims": "26in x 26in", "left": 630, "top": 860, "width": 66, "height": 66, "rotation": 0, "cabType": null, "physicalHeight": "7.2", "mountHeightIn": null, "layer": "dust-collection", "estCost": "650", "clearanceCategory": null },
            { "label": "4in Dust Duct 10ft", "displayName": "4in Dust Duct 10ft", "displayDims": "4in x 10ft", "left": 320, "top": 835, "width": 300, "height": 10.5, "rotation": 0, "cabType": null, "physicalHeight": "7", "mountHeightIn": null, "layer": "dust-collection", "estCost": "35", "clearanceCategory": null },
            { "label": "4in Duct Elbow", "displayName": "4in Duct Elbow", "displayDims": "4in", "left": 300, "top": 825, "width": 18, "height": 18, "rotation": 0, "cabType": null, "physicalHeight": "7", "mountHeightIn": null, "layer": "dust-collection", "estCost": "12", "clearanceCategory": null },
            { "label": "4in Dust Duct 6ft", "displayName": "4in Dust Duct 6ft", "displayDims": "4in x 6ft", "left": 305, "top": 650, "width": 10.5, "height": 180, "rotation": 0, "cabType": null, "physicalHeight": "7", "mountHeightIn": null, "layer": "dust-collection", "estCost": "22", "clearanceCategory": null },
            { "label": "Blast Gate", "displayName": "Blast Gate", "displayDims": "4in", "left": 300, "top": 600, "width": 10.5, "height": 15, "rotation": 0, "cabType": null, "physicalHeight": "7", "mountHeightIn": null, "layer": "dust-collection", "estCost": "18", "clearanceCategory": null },
            { "label": "4in Duct Drop", "displayName": "4in Duct Drop", "displayDims": "4in", "left": 300, "top": 560, "width": 10.5, "height": 15, "rotation": 0, "cabType": null, "physicalHeight": "5", "mountHeightIn": null, "layer": "dust-collection", "estCost": "10", "clearanceCategory": null }
        ],
        "wallFeatures": [
            { "id": "demo-wf1", "type": "door", "x": 360, "y": 5, "angle": 0, "lengthFt": 3, "thicknessFt": 0.4, "label": "Main Entry", "voltage": null, "widthIn": 36, "mountHeightIn": null, "color": null },
            { "id": "demo-wf2", "type": "window", "x": 715, "y": 300, "angle": 90, "lengthFt": 4, "thicknessFt": 0.4, "label": null, "voltage": null, "widthIn": 48, "mountHeightIn": null, "color": null },
            { "id": "demo-wf3", "type": "outlet", "x": 5, "y": 300, "angle": 180, "lengthFt": 0.3, "thicknessFt": 0.4, "label": null, "voltage": "220V", "widthIn": null, "mountHeightIn": 18, "color": null },
            { "id": "demo-wf4", "type": "outlet", "x": 600, "y": 955, "angle": 270, "lengthFt": 0.3, "thicknessFt": 0.4, "label": null, "voltage": "110V", "widthIn": null, "mountHeightIn": 18, "color": null }
        ],
        "internalWalls": [
            { "id": "demo-iw1", "x1": 600, "y1": 700, "x2": 600, "y2": 960, "thicknessFt": 0.375, "label": "Finishing Room" }
        ]
    }'::jsonb as data
)
insert into public.current_layouts (user_id, data, updated_at)
select target_user.id, layout_data.data, now()
from target_user, layout_data
on conflict (user_id) do update set data = excluded.data, updated_at = excluded.updated_at;

with target_user as (
    select id from auth.users where email = 'cjstalcup@kerphplans.com'
),
layout_data as (
    select '{
        "id": "demo-layout-1",
        "name": "[DEMO] Woodworking Shop w/ Dust Collection",
        "savedAt": "2026-07-23T12:00:00.000Z",
        "widthFeet": 24,
        "lengthFeet": 32,
        "ceilingHeightFt": 10,
        "scale": "1",
        "unitSystem": "imperial",
        "shopType": "woodworking",
        "shapeMode": "rectangle",
        "shapePoints": [],
        "tools": [
            { "label": "SawStop PCS175", "displayName": "SawStop PCS175", "displayDims": "36in x 62in", "left": 300, "top": 250, "width": 90, "height": 156, "rotation": 0, "cabType": null, "physicalHeight": "2.9", "mountHeightIn": null, "layer": "tools", "estCost": "4200", "clearanceCategory": "table-saw" },
            { "label": "Laguna 14BX", "displayName": "Laguna 14BX", "displayDims": "25in x 30in", "left": 550, "top": 250, "width": 63, "height": 75, "rotation": 0, "cabType": null, "physicalHeight": "5.8", "mountHeightIn": null, "layer": "tools", "estCost": "2800", "clearanceCategory": null },
            { "label": "Powermatic PJ882", "displayName": "Powermatic PJ882", "displayDims": "17in x 88in", "left": 40, "top": 40, "width": 42, "height": 219, "rotation": 0, "cabType": null, "physicalHeight": "3.0", "mountHeightIn": null, "layer": "tools", "estCost": "3400", "clearanceCategory": null },
            { "label": "DeWalt DW735X", "displayName": "DeWalt DW735X", "displayDims": "22in x 24in", "left": 40, "top": 290, "width": 54, "height": 60, "rotation": 0, "cabType": null, "physicalHeight": "1.8", "mountHeightIn": null, "layer": "tools", "estCost": "650", "clearanceCategory": null },
            { "label": "Husky 52in Mobile Workbench", "displayName": "Husky 52in Mobile Workbench", "displayDims": "52in x 25in", "left": 300, "top": 560, "width": 129, "height": 63, "rotation": 0, "cabType": null, "physicalHeight": "3.3", "mountHeightIn": null, "layer": "tools", "estCost": "450", "clearanceCategory": null },
            { "label": "Base Cabinet - 36in", "displayName": "Base Cabinet - 36in", "displayDims": "36in W x 24in D", "left": 550, "top": 560, "width": 90, "height": 60, "rotation": 0, "cabType": "base", "physicalHeight": "2.9", "mountHeightIn": null, "layer": "cabinets", "estCost": "320", "clearanceCategory": null },
            { "label": "Wall Cabinet - 30in", "displayName": "Wall Cabinet - 30in", "displayDims": "30in W x 12in D", "left": 550, "top": 470, "width": 75, "height": 30, "rotation": 0, "cabType": "wall", "physicalHeight": "2.5", "mountHeightIn": "54", "layer": "cabinets", "estCost": "260", "clearanceCategory": null },
            { "label": "JET DC-1100VX", "displayName": "JET DC-1100VX", "displayDims": "26in x 26in", "left": 630, "top": 860, "width": 66, "height": 66, "rotation": 0, "cabType": null, "physicalHeight": "7.2", "mountHeightIn": null, "layer": "dust-collection", "estCost": "650", "clearanceCategory": null },
            { "label": "4in Dust Duct 10ft", "displayName": "4in Dust Duct 10ft", "displayDims": "4in x 10ft", "left": 320, "top": 835, "width": 300, "height": 10.5, "rotation": 0, "cabType": null, "physicalHeight": "7", "mountHeightIn": null, "layer": "dust-collection", "estCost": "35", "clearanceCategory": null },
            { "label": "4in Duct Elbow", "displayName": "4in Duct Elbow", "displayDims": "4in", "left": 300, "top": 825, "width": 18, "height": 18, "rotation": 0, "cabType": null, "physicalHeight": "7", "mountHeightIn": null, "layer": "dust-collection", "estCost": "12", "clearanceCategory": null },
            { "label": "4in Dust Duct 6ft", "displayName": "4in Dust Duct 6ft", "displayDims": "4in x 6ft", "left": 305, "top": 650, "width": 10.5, "height": 180, "rotation": 0, "cabType": null, "physicalHeight": "7", "mountHeightIn": null, "layer": "dust-collection", "estCost": "22", "clearanceCategory": null },
            { "label": "Blast Gate", "displayName": "Blast Gate", "displayDims": "4in", "left": 300, "top": 600, "width": 10.5, "height": 15, "rotation": 0, "cabType": null, "physicalHeight": "7", "mountHeightIn": null, "layer": "dust-collection", "estCost": "18", "clearanceCategory": null },
            { "label": "4in Duct Drop", "displayName": "4in Duct Drop", "displayDims": "4in", "left": 300, "top": 560, "width": 10.5, "height": 15, "rotation": 0, "cabType": null, "physicalHeight": "5", "mountHeightIn": null, "layer": "dust-collection", "estCost": "10", "clearanceCategory": null }
        ],
        "wallFeatures": [
            { "id": "demo-wf1", "type": "door", "x": 360, "y": 5, "angle": 0, "lengthFt": 3, "thicknessFt": 0.4, "label": "Main Entry", "voltage": null, "widthIn": 36, "mountHeightIn": null, "color": null },
            { "id": "demo-wf2", "type": "window", "x": 715, "y": 300, "angle": 90, "lengthFt": 4, "thicknessFt": 0.4, "label": null, "voltage": null, "widthIn": 48, "mountHeightIn": null, "color": null },
            { "id": "demo-wf3", "type": "outlet", "x": 5, "y": 300, "angle": 180, "lengthFt": 0.3, "thicknessFt": 0.4, "label": null, "voltage": "220V", "widthIn": null, "mountHeightIn": 18, "color": null },
            { "id": "demo-wf4", "type": "outlet", "x": 600, "y": 955, "angle": 270, "lengthFt": 0.3, "thicknessFt": 0.4, "label": null, "voltage": "110V", "widthIn": null, "mountHeightIn": 18, "color": null }
        ],
        "internalWalls": [
            { "id": "demo-iw1", "x1": 600, "y1": 700, "x2": 600, "y2": 960, "thicknessFt": 0.375, "label": "Finishing Room" }
        ]
    }'::jsonb as data
)
insert into public.saved_layouts (user_id, name, layout_type, data)
select target_user.id, '[DEMO] Woodworking Shop w/ Dust Collection', 'workshop', layout_data.data
from target_user, layout_data
where not exists (
    select 1 from public.saved_layouts sl
    where sl.user_id = target_user.id and sl.name = '[DEMO] Woodworking Shop w/ Dust Collection'
);

-- =====================================================================================
-- 2. MY TOOLS — marks the shop tools above as owned, plus two wishlist items, so the home
--    page's My Tools / My Workspace panels are not empty.
-- =====================================================================================

with target_user as (
    select id from auth.users where email = 'cjstalcup@kerphplans.com'
)
insert into public.tool_status (user_id, data, updated_at)
select target_user.id, '{
    "SawStop PCS175": { "status": "owned", "nickname": "Main Table Saw", "attachDC": true, "widthFt": 3, "lengthFt": 5.2, "heightFt": 2.9, "category": "Table Saws" },
    "Laguna 14BX": { "status": "owned", "nickname": "", "attachDC": true, "widthFt": 2.1, "lengthFt": 2.5, "heightFt": 5.8, "category": "Bandsaws" },
    "Powermatic PJ882": { "status": "owned", "nickname": "", "attachDC": true, "widthFt": 1.4, "lengthFt": 7.3, "heightFt": 3.0, "category": "Jointers & Planers" },
    "DeWalt DW735X": { "status": "owned", "nickname": "Planer", "attachDC": true, "widthFt": 1.8, "lengthFt": 2.0, "heightFt": 1.8, "category": "Jointers & Planers" },
    "JET DC-1100VX": { "status": "owned", "nickname": "", "attachDC": false, "widthFt": 2.2, "lengthFt": 2.2, "heightFt": 7.2, "category": "Dust Collection" },
    "Powermatic 201HH": { "status": "wishlist", "widthFt": 2.6, "lengthFt": 3.4, "heightFt": 3.2, "category": "Jointers & Planers" },
    "SawStop RT": { "status": "wishlist", "widthFt": 2.0, "lengthFt": 3.0, "heightFt": 3.0, "category": "Routing" }
}'::jsonb, now()
from target_user
on conflict (user_id) do update set data = excluded.data, updated_at = excluded.updated_at;

-- =====================================================================================
-- 3. PROJECT DESIGNER — two cabinet projects. Seeds the live board (so opening Project
--    Designer shows the base cabinet immediately) plus both projects in My Projects.
-- =====================================================================================

with target_user as (
    select id from auth.users where email = 'cjstalcup@kerphplans.com'
)
insert into public.project_live_state (user_id, panels, hardware, notes, labels, measurements, updated_at)
select
    target_user.id,
    '[
        { "id": "demo-p1", "name": "Left Side Panel", "widthIn": 22, "heightIn": 23, "thicknessIn": 0.75, "material": "plywood-34", "qty": 1, "holes": [], "shapeType": "rectangle" },
        { "id": "demo-p2", "name": "Right Side Panel", "widthIn": 22, "heightIn": 23, "thicknessIn": 0.75, "material": "plywood-34", "qty": 1, "holes": [], "shapeType": "rectangle" },
        { "id": "demo-p3", "name": "Bottom Panel", "widthIn": 34.5, "heightIn": 22, "thicknessIn": 0.75, "material": "plywood-34", "qty": 1, "holes": [], "shapeType": "rectangle" },
        { "id": "demo-p4", "name": "Back Panel", "widthIn": 34.5, "heightIn": 23, "thicknessIn": 0.25, "material": "plywood-14", "qty": 1, "holes": [], "shapeType": "rectangle" },
        { "id": "demo-p5", "name": "Shelf", "widthIn": 33, "heightIn": 21, "thicknessIn": 0.75, "material": "plywood-34", "qty": 1, "holes": [], "shapeType": "rectangle" },
        { "id": "demo-p6", "name": "Door", "widthIn": 17, "heightIn": 23, "thicknessIn": 0.75, "material": "plywood-maple-34", "qty": 2, "holes": [], "shapeType": "rectangle" }
    ]'::jsonb,
    '[
        { "id": "demo-h1", "name": "Cabinet Hinges (pair)", "qty": 2, "have": true },
        { "id": "demo-h2", "name": "Cabinet Door Pull", "qty": 2, "have": false },
        { "id": "demo-h3", "name": "Adjustable Shelf Pins", "qty": 8, "have": true }
    ]'::jsonb,
    'Simple garage base cabinet for the dust collector corner. Maple ply doors over 3/4in plywood carcass.',
    '[]'::jsonb,
    '[]'::jsonb,
    now()
from target_user
on conflict (user_id) do update set
    panels = excluded.panels, hardware = excluded.hardware, notes = excluded.notes,
    labels = excluded.labels, measurements = excluded.measurements, updated_at = excluded.updated_at;

with target_user as (
    select id from auth.users where email = 'cjstalcup@kerphplans.com'
)
insert into public.saved_projects (user_id, name, data)
select target_user.id, '[DEMO] Garage Base Cabinet', ('{
    "id": "demo-proj-1", "name": "[DEMO] Garage Base Cabinet", "savedAt": "2026-07-23T12:00:00.000Z",
    "panels": [
        { "id": "demo-p1", "name": "Left Side Panel", "widthIn": 22, "heightIn": 23, "thicknessIn": 0.75, "material": "plywood-34", "qty": 1, "holes": [], "shapeType": "rectangle" },
        { "id": "demo-p2", "name": "Right Side Panel", "widthIn": 22, "heightIn": 23, "thicknessIn": 0.75, "material": "plywood-34", "qty": 1, "holes": [], "shapeType": "rectangle" },
        { "id": "demo-p3", "name": "Bottom Panel", "widthIn": 34.5, "heightIn": 22, "thicknessIn": 0.75, "material": "plywood-34", "qty": 1, "holes": [], "shapeType": "rectangle" },
        { "id": "demo-p4", "name": "Back Panel", "widthIn": 34.5, "heightIn": 23, "thicknessIn": 0.25, "material": "plywood-14", "qty": 1, "holes": [], "shapeType": "rectangle" },
        { "id": "demo-p5", "name": "Shelf", "widthIn": 33, "heightIn": 21, "thicknessIn": 0.75, "material": "plywood-34", "qty": 1, "holes": [], "shapeType": "rectangle" },
        { "id": "demo-p6", "name": "Door", "widthIn": 17, "heightIn": 23, "thicknessIn": 0.75, "material": "plywood-maple-34", "qty": 2, "holes": [], "shapeType": "rectangle" }
    ],
    "hardware": [
        { "id": "demo-h1", "name": "Cabinet Hinges (pair)", "qty": 2, "have": true },
        { "id": "demo-h2", "name": "Cabinet Door Pull", "qty": 2, "have": false },
        { "id": "demo-h3", "name": "Adjustable Shelf Pins", "qty": 8, "have": true }
    ],
    "notes": "Simple garage base cabinet for the dust collector corner. Maple ply doors over 3/4in plywood carcass.",
    "labels": [], "measurements": []
}')::jsonb
from target_user
where not exists (
    select 1 from public.saved_projects sp
    where sp.user_id = target_user.id and sp.name = '[DEMO] Garage Base Cabinet'
);

with target_user as (
    select id from auth.users where email = 'cjstalcup@kerphplans.com'
)
insert into public.saved_projects (user_id, name, data)
select target_user.id, '[DEMO] Wall-Mounted Tool Cabinet', ('{
    "id": "demo-proj-2", "name": "[DEMO] Wall-Mounted Tool Cabinet", "savedAt": "2026-07-23T12:00:00.000Z",
    "panels": [
        { "id": "demo-p7", "name": "Left Side", "widthIn": 12, "heightIn": 30, "thicknessIn": 0.75, "material": "plywood-baltic-birch-34", "qty": 1, "holes": [], "shapeType": "rectangle" },
        { "id": "demo-p8", "name": "Right Side", "widthIn": 12, "heightIn": 30, "thicknessIn": 0.75, "material": "plywood-baltic-birch-34", "qty": 1, "holes": [], "shapeType": "rectangle" },
        { "id": "demo-p9", "name": "Top", "widthIn": 24, "heightIn": 12, "thicknessIn": 0.75, "material": "plywood-baltic-birch-34", "qty": 1, "holes": [], "shapeType": "rectangle" },
        { "id": "demo-p10", "name": "Bottom", "widthIn": 24, "heightIn": 12, "thicknessIn": 0.75, "material": "plywood-baltic-birch-34", "qty": 1, "holes": [], "shapeType": "rectangle" },
        { "id": "demo-p11", "name": "Back", "widthIn": 24, "heightIn": 30, "thicknessIn": 0.25, "material": "plywood-14", "qty": 1, "holes": [], "shapeType": "rectangle" },
        { "id": "demo-p12", "name": "Door", "widthIn": 24, "heightIn": 30, "thicknessIn": 0.75, "material": "hardwood-red-oak", "qty": 1, "holes": [], "shapeType": "rectangle" }
    ],
    "hardware": [
        { "id": "demo-h4", "name": "Piano Hinge 30in", "qty": 1, "have": false },
        { "id": "demo-h5", "name": "Magnetic Catch", "qty": 2, "have": true }
    ],
    "notes": "Wall cabinet for hand tool storage above the workbench. Red oak door over baltic birch carcass.",
    "labels": [], "measurements": []
}')::jsonb
from target_user
where not exists (
    select 1 from public.saved_projects sp
    where sp.user_id = target_user.id and sp.name = '[DEMO] Wall-Mounted Tool Cabinet'
);

-- =====================================================================================
-- 4. CUT LIST OPTIMIZER — a non-trivial parts list ready to optimize (singleton, live only).
-- =====================================================================================

with target_user as (
    select id from auth.users where email = 'cjstalcup@kerphplans.com'
)
insert into public.cutlist_live_parts (user_id, data, updated_at)
select target_user.id, '[
    { "id": "demo-cl1", "name": "Side Panel", "widthIn": 12, "heightIn": 30, "thicknessIn": 0.75, "material": "plywood-34", "qty": 4, "grainLocked": true },
    { "id": "demo-cl2", "name": "Shelf", "widthIn": 11.25, "heightIn": 23.25, "thicknessIn": 0.75, "material": "plywood-34", "qty": 6, "grainLocked": false },
    { "id": "demo-cl3", "name": "Back Panel", "widthIn": 24, "heightIn": 30, "thicknessIn": 0.25, "material": "mdf-34", "qty": 2, "grainLocked": false },
    { "id": "demo-cl4", "name": "Face Frame Stile", "widthIn": 1.5, "heightIn": 30, "thicknessIn": 0.75, "material": "hardwood-red-oak", "qty": 8, "grainLocked": true },
    { "id": "demo-cl5", "name": "Face Frame Rail", "widthIn": 1.5, "heightIn": 22, "thicknessIn": 0.75, "material": "hardwood-red-oak", "qty": 6, "grainLocked": true },
    { "id": "demo-cl6", "name": "Drawer Front", "widthIn": 14, "heightIn": 6, "thicknessIn": 0.75, "material": "hardwood-maple", "qty": 3, "grainLocked": true }
]'::jsonb, now()
from target_user
on conflict (user_id) do update set data = excluded.data, updated_at = excluded.updated_at;

-- =====================================================================================
-- 5. QUOTE BUILDER — three quotes across draft / sent / accepted states.
-- =====================================================================================

with target_user as (
    select id from auth.users where email = 'cjstalcup@kerphplans.com'
)
insert into public.quotes (user_id, name, data)
select target_user.id, '[DEMO] Kitchen Cabinet Refresh', ('{
    "id": "demo-q1", "name": "[DEMO] Kitchen Cabinet Refresh", "clientName": "Sarah Miller",
    "clientEmail": "sarah.miller@example.com", "projectName": "Kitchen Cabinet Refresh",
    "date": "2026-07-05",
    "materials": [
        { "id": "m1", "name": "Maple Plywood Sheets (10)", "cost": 850 },
        { "id": "m2", "name": "Cabinet Hardware Set", "cost": 220 },
        { "id": "m3", "name": "Finish and Stain Supplies", "cost": 95 }
    ],
    "laborHours": 32, "laborRate": 65, "consumables": 60,
    "overheadPct": 15, "marginPct": 20, "status": "accepted",
    "shareToken": "8f14e45f-ceea-4d5a-8f8a-000000000001",
    "clientNotes": "Looks great, moving forward!",
    "clientRespondedAt": "2026-07-10T15:30:00.000Z",
    "actual": { "materialsCost": null, "laborHours": null, "consumables": null }
}')::jsonb
from target_user
where not exists (
    select 1 from public.quotes q where q.user_id = target_user.id and q.name = '[DEMO] Kitchen Cabinet Refresh'
);

with target_user as (
    select id from auth.users where email = 'cjstalcup@kerphplans.com'
)
insert into public.quotes (user_id, name, data)
select target_user.id, '[DEMO] Garage Workbench Build', ('{
    "id": "demo-q2", "name": "[DEMO] Garage Workbench Build", "clientName": "Tom Bennett",
    "clientEmail": "tbennett@example.com", "projectName": "Custom Garage Workbench",
    "date": "2026-07-15",
    "materials": [
        { "id": "m4", "name": "2x4 Lumber Bundle", "cost": 140 },
        { "id": "m5", "name": "3/4in Plywood Top", "cost": 95 },
        { "id": "m6", "name": "Vise and Mounting Hardware", "cost": 180 }
    ],
    "laborHours": 14, "laborRate": 60, "consumables": 40,
    "overheadPct": 12, "marginPct": 18, "status": "sent",
    "shareToken": "8f14e45f-ceea-4d5a-8f8a-000000000002",
    "clientNotes": null, "clientRespondedAt": null,
    "actual": { "materialsCost": null, "laborHours": null, "consumables": null }
}')::jsonb
from target_user
where not exists (
    select 1 from public.quotes q where q.user_id = target_user.id and q.name = '[DEMO] Garage Workbench Build'
);

with target_user as (
    select id from auth.users where email = 'cjstalcup@kerphplans.com'
)
insert into public.quotes (user_id, name, data)
select target_user.id, '[DEMO] Built-in Bookshelf', ('{
    "id": "demo-q3", "name": "[DEMO] Built-in Bookshelf", "clientName": "Priya Anand",
    "clientEmail": "priya.a@example.com", "projectName": "Living Room Built-ins",
    "date": "2026-07-20",
    "materials": [
        { "id": "m7", "name": "Red Oak Boards", "cost": 610 },
        { "id": "m8", "name": "Plywood Backing", "cost": 120 }
    ],
    "laborHours": 40, "laborRate": 65, "consumables": 50,
    "overheadPct": 15, "marginPct": 22, "status": "draft",
    "shareToken": null, "clientNotes": null, "clientRespondedAt": null,
    "actual": { "materialsCost": null, "laborHours": null, "consumables": null }
}')::jsonb
from target_user
where not exists (
    select 1 from public.quotes q where q.user_id = target_user.id and q.name = '[DEMO] Built-in Bookshelf'
);

-- =====================================================================================
-- 6. PORTFOLIO — two public projects (no photos attached; this script cannot upload real
--    image files, so cover_path/gallery_paths are left empty — add photos from the Portfolio
--    page itself whenever you want).
-- =====================================================================================

with target_user as (
    select id from auth.users where email = 'cjstalcup@kerphplans.com'
)
insert into public.portfolio_projects (user_id, title, description, materials, finish, plan_source, cover_path, gallery_paths, is_public)
select target_user.id, '[DEMO] Handcrafted Walnut Dining Table',
    'A live-edge black walnut dining table with a hand-rubbed oil finish. Built as a custom commission, seats six.',
    'Black walnut, steel hairpin legs', 'Danish oil, 3 coats', 'Original design', null, '{}', true
from target_user
where not exists (
    select 1 from public.portfolio_projects pp
    where pp.user_id = target_user.id and pp.title = '[DEMO] Handcrafted Walnut Dining Table'
);

with target_user as (
    select id from auth.users where email = 'cjstalcup@kerphplans.com'
)
insert into public.portfolio_projects (user_id, title, description, materials, finish, plan_source, cover_path, gallery_paths, is_public)
select target_user.id, '[DEMO] Garage Workshop Storage Wall',
    'Full-wall pegboard and cabinet storage system built to organize hand tools and clamps.',
    'Baltic birch plywood, pegboard', 'Clear polyurethane', 'Kerph Project Designer', null, '{}', true
from target_user
where not exists (
    select 1 from public.portfolio_projects pp
    where pp.user_id = target_user.id and pp.title = '[DEMO] Garage Workshop Storage Wall'
);

-- =====================================================================================
-- 7. SHOP SHOWCASE — one public community post (author name pulled from your real profile).
-- =====================================================================================

with target_user as (
    select u.id, coalesce(p.username, split_part(u.email, '@', 1)) as author
    from auth.users u
    left join public.profiles p on p.id = u.id
    where u.email = 'cjstalcup@kerphplans.com'
)
insert into public.showcase_posts (user_id, title, description, image_path, tags, author)
select target_user.id,
    '[DEMO] Just finished this walnut dining table',
    'Live-edge black walnut, six-seat dining table. Finished with 3 coats of Danish oil. Built over about six weekends.',
    null, array['walnut','dining-table','live-edge','furniture','demo'], target_user.author
from target_user
where not exists (
    select 1 from public.showcase_posts sp
    where sp.user_id = target_user.id and sp.title = '[DEMO] Just finished this walnut dining table'
);
