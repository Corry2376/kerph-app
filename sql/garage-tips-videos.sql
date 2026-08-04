-- Adds video links to the 3 published Garage Tips articles: one primary video per article via
-- video_url (renders as a real embedded player at the top of the article, per the site's
-- existing layout -- that slot is always at the top, that part isn't something this script
-- controls) plus 1-2 additional video links woven directly into the relevant paragraph of the
-- body text itself, in the same inline-link style already used for the manufacturer/retailer
-- links in these articles -- not a "Related Videos" block at the end.
--
-- This replaces body_html entirely (matching the exact live content as of the last version of
-- sql/garage-tips-articles.sql, plus the video sentences below) rather than appending, so it
-- reproduces the full article text verbatim except for the new sentences. Safe to re-run.
--
-- All videos are real, found via live search, not guessed IDs.

do $$
declare
    v_user_id uuid;
    v_title text := $title$Top 10 Most Popular Table Saws in 2026$title$;
    v_video text := 'https://www.youtube.com/watch?v=FrILkvFIdY4';
    v_body text := $body$
<p>Ask five people what the "best" table saw is and you'll get five different answers, mostly depending on how much floor space and money they're working with. That's honestly the more useful way to think about this list. A $300 benchtop saw and a $3,500 cabinet saw aren't really rivals; they're solving different problems. So instead of crowning one winner, here are ten saws that keep coming up across every price bracket, and what actually sets each one apart.</p>

<div style="margin:16px 0;">
<img src="https://upload.wikimedia.org/wikipedia/commons/f/fc/SawStop.jpg" alt="A SawStop cabinet table saw in a shared workshop" style="width:100%;max-width:480px;display:block;" />
<p style="margin:6px 0 0;font-size:11.5px;color:#94a3b8;">A SawStop earning its keep in a shared workshop. Photo: Comfr, via Wikimedia Commons (CC BY-SA 4.0).</p>
</div>

<p>Broadly, saws fall into five tiers: benchtop and jobsite saws you can carry out to a truck, contractor saws that live mostly in one place but still ride on wheels, hybrid saws with an enclosed base for real dust collection, and full cabinet saws built to run all day without complaint. Street prices roughly track that order too, from a couple hundred dollars up into five figures for the biggest industrial cabinet saws.</p>

<p>This isn't a lab test. It's a working list built from real specs, honest reputations, and what actually shows up in shop conversations and reviews across the price range. Ranking weighs motor power and rip capacity, fence quality, table size, safety features, and value within each saw's own category.</p>

<h2>The Top 10</h2>

<h3>1. SawStop PCS175</h3>
<p>SawStop built its whole reputation on one feature: a flesh-detection system that stops the blade in under five milliseconds if it senses skin, dropping the assembly below the table before real damage happens. The Professional Cabinet Saw is where most shops meet that technology for the first time, and it earns its price with more than just safety -- the T-Glide fence locks in dead parallel and mostly gets set once and forgotten. At 1.75 HP and roughly 440 lbs, it's not the biggest saw on this list, but it's the one most often named when someone asks what to buy without a budget ceiling. <a href="https://www.sawstop.com/products/professional-cabinet-saw/" target="_blank" rel="noopener">SawStop's product page</a> has the full spec sheet.</p>

<h3>2. SawStop ICS</h3>
<div style="margin:12px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px;display:flex;align-items:center;justify-content:center;">
<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg">
<rect x="15" y="55" width="110" height="8" rx="2" fill="#1e3a8a"/>
<rect x="25" y="63" width="6" height="28" fill="#64748b"/>
<rect x="109" y="63" width="6" height="28" fill="#64748b"/>
<path d="M 60 55 A 22 22 0 0 1 90 40" stroke="#1e3a8a" stroke-width="5" fill="none" stroke-linecap="round"/>
<rect x="95" y="30" width="4" height="30" fill="#94a3b8"/>
<rect x="95" y="28" width="20" height="6" rx="2" fill="#94a3b8"/>
</svg>
</div>
<p>Step up from the PCS and you get the Industrial Cabinet Saw: same braking technology, but built for shops that don't get a day off. Motor options run up to 5 HP with true 3-phase power, and the extra weight (around 600 lbs) shows up as noticeably less vibration at the cut. It's overkill for a home shop and exactly right for a production one. <a href="https://www.sawstop.com/products/industrial-cabinet-saw/" target="_blank" rel="noopener">See the full ICS lineup</a> on SawStop's site.</p>

<h3>3. Powermatic PM1000</h3>
<div style="margin:16px 0;">
<img src="https://www.rockler.com/media/catalog/product/4/9/49024-01-1000.jpg?quality=80&bg-color=255,255,255&fit=bounds&height=760&width=760&canvas=760:760" alt="Powermatic PM1000 table saw with Accu-Fence" style="width:100%;max-width:420px;display:block;" />
</div>
<p>Powermatic's Accu-Fence is one of the most imitated fence designs in the industry, and the PM1000 is usually the saw people mean when they say they want "a Powermatic." At about 289 lbs it's genuinely lighter than a full cabinet saw, without feeling like a step down at the cut -- a common landing spot for anyone who wants cabinet-saw manners without cabinet-saw weight. <a href="https://www.rockler.com/powermatic-pm1000-1-3-4-hp-table-saw-1-phase-with-30-accu-fence-system" target="_blank" rel="noopener">Rockler carries it</a> in a few fence-length configurations.</p>

<h3>4. Grizzly G0690</h3>
<div style="margin:12px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px;display:flex;align-items:center;justify-content:center;">
<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg">
<rect x="15" y="55" width="110" height="8" rx="2" fill="#1e3a8a"/>
<rect x="25" y="63" width="6" height="28" fill="#64748b"/>
<rect x="109" y="63" width="6" height="28" fill="#64748b"/>
<path d="M 60 55 A 22 22 0 0 1 90 40" stroke="#1e3a8a" stroke-width="5" fill="none" stroke-linecap="round"/>
<rect x="95" y="30" width="4" height="30" fill="#94a3b8"/>
<rect x="95" y="28" width="20" height="6" rx="2" fill="#94a3b8"/>
</svg>
</div>
<p>Grizzly's pitch has always been the same: give woodworkers full cabinet-saw performance without the full cabinet-saw price tag, and the G0690 is the model that gets pointed to most often as proof it works. Three horsepower, triple belt drive, a table big enough to handle full sheets -- it undercuts the name-brand competition by a wide enough margin that it's become the default answer in budget-conscious shop-building threads. <a href="https://www.grizzly.com/products/Grizzly-10-3HP-220V-Cabinet-Table-Saw-with-Riving-Knife/G0690" target="_blank" rel="noopener">Grizzly's product page</a> has the full breakdown.</p>

<h3>5. Grizzly G0715P</h3>
<div style="margin:12px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px;display:flex;align-items:center;justify-content:center;">
<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg">
<rect x="15" y="55" width="110" height="8" rx="2" fill="#1e3a8a"/>
<rect x="25" y="63" width="6" height="28" fill="#64748b"/>
<rect x="109" y="63" width="6" height="28" fill="#64748b"/>
<path d="M 60 55 A 22 22 0 0 1 90 40" stroke="#1e3a8a" stroke-width="5" fill="none" stroke-linecap="round"/>
<rect x="95" y="30" width="4" height="30" fill="#94a3b8"/>
<rect x="95" y="28" width="20" height="6" rx="2" fill="#94a3b8"/>
</svg>
</div>
<p>The G0715P is Grizzly's hybrid: an enclosed base for real dust collection, a lighter cast-iron table than the G0690, and a price that splits the difference between a contractor saw and a full cabinet saw. It's the saw a lot of people buy the day their jobsite saw stops being good enough, before they're ready to commit to something heavier. <a href="https://www.grizzly.com/products/Grizzly-10-Hybrid-Table-Saw-with-Riving-Knife-Polar-Bear-Series/G0715P" target="_blank" rel="noopener">Grizzly's page</a> covers the full spec sheet.</p>

<h3>6. Delta 36-L352</h3>
<div style="margin:12px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px;display:flex;align-items:center;justify-content:center;">
<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg">
<rect x="15" y="55" width="110" height="8" rx="2" fill="#1e3a8a"/>
<rect x="25" y="63" width="6" height="28" fill="#64748b"/>
<rect x="109" y="63" width="6" height="28" fill="#64748b"/>
<path d="M 60 55 A 22 22 0 0 1 90 40" stroke="#1e3a8a" stroke-width="5" fill="none" stroke-linecap="round"/>
<rect x="95" y="30" width="4" height="30" fill="#94a3b8"/>
<rect x="95" y="28" width="20" height="6" rx="2" fill="#94a3b8"/>
</svg>
</div>
<p>Delta has been in the table saw business since long before most of the other names on this list existed, and the Unisaw line is where that history shows. The 36-L352 pairs a 3 HP motor with a 52" Biesemeyer fence -- accurate to within 1/64" -- and a bi-level dust extraction system that actually keeps the cabinet interior clean instead of just claiming to. <a href="https://deltamachinery.com/product/36-l352-3-hp-motor-10-unisaw-with-52-biesemeyer-fence-system/" target="_blank" rel="noopener">Delta's product page</a> has the details.</p>

<h3>7. DeWalt DWE7491RS</h3>
<div style="margin:16px 0;">
<img src="https://assets.dewalt.com/NAG/PRODUCT/IMAGES/HIRES/WHITEBG/DWE7491RS_1_1680.webp" alt="DeWalt DWE7491RS jobsite table saw on its rolling stand" style="width:100%;max-width:420px;display:block;" />
</div>
<p>If there's a default answer to "what jobsite saw should I buy," this is usually it. The rack-and-pinion fence stays accurate even after being folded up and thrown in a truck bed a hundred times, and the 32.5" rip capacity is unusually generous for something this portable. Fifteen amps, 120V, about 90 lbs with the rolling stand -- nothing on the spec sheet is exciting, and that's sort of the point. <a href="https://www.dewalt.com/en-us/product/dwe7491rs/10-jobsite-table-saw-and-rolling-stand" target="_blank" rel="noopener">DeWalt's page</a> has it in full.</p>

<h3>8. RIDGID R4518</h3>
<div style="margin:12px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px;display:flex;align-items:center;justify-content:center;">
<svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg">
<rect x="15" y="55" width="110" height="8" rx="2" fill="#1e3a8a"/>
<rect x="25" y="63" width="6" height="28" fill="#64748b"/>
<rect x="109" y="63" width="6" height="28" fill="#64748b"/>
<path d="M 60 55 A 22 22 0 0 1 90 40" stroke="#1e3a8a" stroke-width="5" fill="none" stroke-linecap="round"/>
<rect x="95" y="30" width="4" height="30" fill="#94a3b8"/>
<rect x="95" y="28" width="20" height="6" rx="2" fill="#94a3b8"/>
</svg>
</div>
<p>RIDGID's take on the same portable-saw formula trades a little of the DeWalt's polish for a friendlier price and RIDGID's lifetime service agreement, which matters more than it sounds like once a saw has spent a few years riding around in a truck bed. Folding stand, 15A motor, about 75 lbs -- close enough to the DeWalt on paper that the choice usually just comes down to whichever one's on sale. <a href="https://www.homedepot.com/p/RIDGID-15-Amp-10-in-Portable-Corded-Jobsite-Table-Saw-with-Folding-Stand-R4518/309413142" target="_blank" rel="noopener">Home Depot carries it</a>.</p>
<p>For a closer side-by-side look at portable saws in this class, <a href="https://www.youtube.com/watch?v=GbBUPrrx77s" target="_blank" rel="noopener">this buyer's guide</a> walks through several 2026 jobsite models back to back.</p>

<h3>9. Makita 2705</h3>
<div style="margin:16px 0;">
<img src="https://www.cpooutlets.com/on/demandware.static/-/Sites-cpo-master-catalog/default/dw2ee04471/product_media/mkt/mktn2705/images/xlarge/mktn2705.jpg" alt="Makita 2705 contractor table saw" style="width:100%;max-width:420px;display:block;" />
</div>
<p>The 2705 has been around long enough to earn a reputation most newer contractor saws haven't had time to build. The 15A motor runs smoother and quieter than most saws in its class, and it's held up well enough over the years that it still gets recommended by people whose saw is a decade old. <a href="https://www.makitatools.com/" target="_blank" rel="noopener">Makita's site</a> or most tool retailers carry it.</p>

<h3>10. SKIL TS6307-00</h3>
<div style="margin:16px 0;">
<img src="https://www.skil.com/cdn/shop/files/ts6307_skil_tablesaw_profile_shadow_23-0314_main_1000.png?v=1751490797" alt="SKIL TS6307-00 table saw with folding stand" style="width:100%;max-width:420px;display:block;" />
</div>
<p>Every list like this needs a floor, and the TS6307-00 is a legitimate one, not a toy. Folding stand, a fence that actually holds its setting, and enough power to handle plywood and dimensional lumber. It's not going to replace a cabinet saw, but it's a completely reasonable first table saw for a shop that's just getting started. <a href="https://www.skil.com/products/15-amp-10inch-table-saw-ts6307-00" target="_blank" rel="noopener">SKIL's page</a> has the specs.</p>

<h2>Cabinet, Hybrid, Contractor, or Jobsite?</h2>
<p>Jobsite and benchtop saws make sense when there's no permanent spot for one -- you're trading some accuracy for the ability to fold it up and roll it away. Contractor saws step up in power but usually keep an open base, which means dust collection is a permanent, low-grade fight. Hybrid saws close the base up and get real dust collection without the full jump to cabinet-saw weight; it's the most common landing spot for anyone who's outgrown a jobsite saw. And full cabinet saws are, simply, as good as it gets: heaviest, quietest, flattest tables, worth it once a shop has a fixed address and the saw earns its keep every day.</p>
<p>Whatever ends up on the floor, it's worth laying out the space around it before it shows up -- clearances, outfeed room, where the dust collection branch is going to run. That's exactly what the <a href="workshop-planner.html">Workshop Planner</a> is for.</p>
$body$;
begin
    select id into v_user_id from auth.users where email = 'cjstalcup@kerphplans.com';
    update public.garage_tips
    set video_url = v_video, body_html = v_body, updated_at = now()
    where user_id = v_user_id and title = v_title;
end $$;

do $$
declare
    v_user_id uuid;
    v_title text := $title$The Shop Maintenance Guide: Table Saw, Band Saw & Jointer/Planer$title$;
    v_video text := 'https://www.youtube.com/watch?v=tuCD1nJSY4Q';
    v_body text := $body$
<p>Nobody skips maintenance on purpose. It happens because there's no rhythm to it -- "I'll get to it" quietly turns into six months of pitch buildup and a fence that's crept out of true. None of what follows is complicated. It just needs a schedule, and most of it takes less time than finding the right allen wrench.</p>

<div style="margin:16px 0;">
<img src="https://upload.wikimedia.org/wikipedia/commons/f/fc/SawStop.jpg" alt="A table saw with a clean, waxed table top" style="width:100%;max-width:480px;display:block;" />
<p style="margin:6px 0 0;font-size:11.5px;color:#94a3b8;">A clean table and a properly aligned fence are most of the job. Photo: Comfr, via Wikimedia Commons (CC BY-SA 4.0).</p>
</div>

<p>This covers the three stationary tools doing the most work in a typical shop, on a weekly, monthly, and quarterly rhythm loose enough to actually stick to.</p>

<h2>Table Saw</h2>
<p>Weekly, it's really just housekeeping: brush and vacuum the sawdust out from under the table and off the motor housing (buildup around the motor is a heat problem, not just a mess), wipe the table down, and glance at the blade for resin buildup.</p>
<p>Monthly is where it actually matters. Rip a test board and check it against a combination square to confirm the blade's still parallel to the miter slot -- this is the single most common thing that drifts, and the thing most people never think to check. Wax the table and fence rails with a paste wax (a spray lubricant just attracts more dust than it repels), check the throat plate for chipping, and confirm the riving knife is still lined up with the blade.</p>
<p>Every few months, go a level deeper: check the drive belt's tension and condition, look for any trunnion bolts that have worked loose from vibration, and vacuum out the inside of the cabinet. That's where the fine dust actually collects, and it's the part everyone forgets exists.</p>

<h2>Band Saw</h2>
<div style="margin:16px 0;">
<img src="https://upload.wikimedia.org/wikipedia/commons/9/93/Band_saw_photo.jpg" alt="A band saw in a workshop" style="width:100%;max-width:480px;display:block;" />
<p style="margin:6px 0 0;font-size:11.5px;color:#94a3b8;">U.S. government photo, public domain, via Wikimedia Commons.</p>
</div>
<p>Band saw blades pick up resin and pitch constantly, and it's much easier to brush off fresh than after it's baked on for a month. That alone is worth doing weekly, along with a quick check on blade tracking and clearing dust from the lower wheel housing.</p>
<p>Once a month, check blade tension (a flex test works fine, or a real tension gauge if there's one around) and look at the guide bearings and blocks -- they should make light, even contact with the blade, not drag against it or float clear of it. Clean and wax the table while you're in there.</p>
<p>If tensioning by feel makes you nervous the first few times, <a href="https://www.youtube.com/watch?v=btM1CZv670U" target="_blank" rel="noopener">this walkthrough</a> shows the process start to finish.</p>
<p>Every few months, look over both wheel tires for glazing or cracking, put a little lubricant on the trunnion, and confirm the upper and lower wheels are still coplanar. A saw that's drifted out of alignment there is the single most common reason a blade won't stop wandering off the line, and most people chase every other explanation first.</p>

<h2>Jointer &amp; Planer</h2>
<div style="margin:16px 0;">
<img src="https://www.woodcraft.com/cdn/shop/files/830127_000_001_1946x.jpg?v=1720483730" alt="Powermatic PJ882 8-inch parallelogram jointer" style="width:100%;max-width:420px;display:block;" />
</div>
<p>These two get grouped together because the failure mode is basically identical: chip buildup wrecking an otherwise good cut. Weekly, clear the cutterhead and the infeed/outfeed rollers, and wipe the tables down.</p>
<div style="margin:16px 0;">
<img src="https://assets.dewalt.com/NAG/PRODUCT/IMAGES/HIRES/WHITEBG/DW735X_1_1680.webp" alt="DeWalt DW735X thickness planer" style="width:100%;max-width:420px;display:block;" />
</div>
<p>Monthly, check that the jointer's infeed and outfeed tables are still coplanar (and wax them while you're there), look over the knives or cutterhead inserts for nicks, and confirm the fence is still square.</p>
<p><a href="https://www.youtube.com/watch?v=PNOt1SvjoLs" target="_blank" rel="noopener">This video</a> shows the actual dial-indicator process for checking table coplanarity, if it's not something you've done before.</p>
<p>Every few months, rotate or resharpen the knives, check belt or chain tension, lubricate the planer's lift screws, and clear out the dust chute. A partially clogged chute is a sneaky, easy-to-miss cause of chip marks showing up on the workpiece for no obvious reason.</p>

<h2>The maintenance log that actually survives</h2>
<p>Sticky notes and paper logs rarely make it past the first month. They work a lot better attached to the tool record itself than living in a notebook that gets buried on a shelf somewhere. Kerph's <a href="index.html">My Tools</a> list has maintenance reminders built in per tool, so the schedule runs itself instead of depending on memory.</p>
$body$;
begin
    select id into v_user_id from auth.users where email = 'cjstalcup@kerphplans.com';
    update public.garage_tips
    set video_url = v_video, body_html = v_body, updated_at = now()
    where user_id = v_user_id and title = v_title;
end $$;

do $$
declare
    v_user_id uuid;
    v_title text := $title$Dust Collection Setup: Tips & Tricks for a Shop That Actually Breathes$title$;
    v_video text := 'https://www.youtube.com/watch?v=NzBZk1NxQfg';
    v_body text := $body$
<p>Dust collection has a way of failing quietly. A collector rated for 1,200 CFM can end up moving a few hundred by the time the air actually reaches the far end of an undersized branch line, and a shop just slowly fills up with fine dust that nobody notices accumulating until it's everywhere. The collector matters less than most people think. The system around it is what actually decides whether it works.</p>

<div style="margin:16px 0;">
<img src="https://jettools.com/media/catalog/product/cache/0ca0ea9ac66616e29e808a123aec7ba8/7/0/708659k_main_84ce.png" alt="JET DC-1100VX single-stage dust collector" style="width:100%;max-width:420px;display:block;" />
<p style="margin:6px 0 0;font-size:11.5px;color:#94a3b8;">A single-stage collector like this one is only as good as the ductwork feeding it.</p>
</div>

<h2>Size the main trunk to the collector, not the biggest machine</h2>
<p>The main trunk needs to move as much air as the collector can actually produce -- undersize it and the whole system chokes, no matter how good the collector is. A common single-stage 1&ndash;2 HP setup runs a 4"&ndash;6" main trunk; check the collector's rated CFM against a duct sizing chart before committing to a diameter, because guessing here is the single most common way a new dust collection system underperforms from day one.</p>

<h2>Branch lines can step down, but do the CFM math first</h2>
<p>Branch runs to an individual machine can usually step down from there, often to 4" for a single-machine drop. What actually matters is whether that branch can still deliver the CFM the tool needs -- a table saw wants somewhere around 350&ndash;400 CFM at the cutting zone, a jointer or planer with a wide cutterhead closer to 400&ndash;450+. A branch that looks fine on paper but runs too long, or has one too many fittings in it, can still starve the tool at the far end.</p>
<p><a href="https://www.youtube.com/watch?v=ia_kpQjqvQs" target="_blank" rel="noopener">This walkthrough</a> covers the CFM math in more detail if you want to run the numbers yourself before buying pipe.</p>

<h2>Blast gates: one open at a time</h2>
<p>Every blast gate left open splits the collector's suction across all of them, which is a very easy way to end up with a system that "should" be moving plenty of air but doesn't feel like it at any single machine. Close everything except whatever's actually running -- it's the single cheapest fix available, and it costs nothing but a habit. Kerph's <a href="workshop-planner.html">Workshop Planner</a> has a dedicated Dust Collection layer for placing and labeling blast gates right on the actual shop layout, so it's obvious at a glance which gate belongs to which run.</p>

<div style="margin:16px 0;">
<img src="https://www.oneida-air.com/media/catalog/product/cache/fc99c832dc48ff7fc2322c734391a48e/s/u/super-dust-deputy-xl-cyclone-front-left.jpg" alt="Oneida Super Dust Deputy XL cyclone separator" style="width:100%;max-width:420px;display:block;" />
<p style="margin:6px 0 0;font-size:11.5px;color:#94a3b8;">A cyclone separator like this one pulls most of the chips and heavy debris out before they ever reach the filter.</p>
</div>

<h2>Minimize elbows, maximize sweep</h2>
<p>Every 90&deg; elbow costs roughly as much static pressure as several feet of straight pipe. Two 45s, or a long-sweep 90 instead of a tight one, move the same air with noticeably less resistance -- worth the few extra dollars in fittings on any run longer than a few feet.</p>

<h2>Ground it if you're running plastic pipe</h2>
<p>PVC and other plastic ducting build up static charge as dust moves through it, which is worth taking seriously rather than dismissing as shop folklore. Running a grounding wire through or along the inside of the pipe, bonded to a real ground, is standard practice for plastic dust collection systems -- do it from the start rather than after something gets somebody's attention.</p>

<h2>Filter micron rating matters more than bag size</h2>
<p>A big felt collection bag looks like it's doing the job, but standard bags are usually only rated down to somewhere around 30&ndash;75 microns. The dust that actually matters for lungs sails right through that and settles right back over the shop. Swapping to a 1-micron canister or cartridge filter is, dollar for dollar, probably the single highest-impact upgrade a dust collection system can get.</p>

<h2>Plan the system before the pipe goes up</h2>
<p>Duct runs are a lot easier to size right on a layout than to rebuild after the fact. Kerph's Dust Collection layer includes a sizing calculator that checks branch-vs-main duct sizing against a real collector fan curve and estimates system cost before a single foot of pipe gets bought -- worth ten minutes before committing to a path.</p>
$body$;
begin
    select id into v_user_id from auth.users where email = 'cjstalcup@kerphplans.com';
    update public.garage_tips
    set video_url = v_video, body_html = v_body, updated_at = now()
    where user_id = v_user_id and title = v_title;
end $$;
