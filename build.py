"""AgriHire page generator.

Run:  python3 build.py
Writes one .html file per page next to this script (and deletes old pages that no longer exist).
All text is bilingual: T(english, hindi). Lists and numbers are filled by app.js from the database.

Flow:  index (login) -> register -> otp -> role -> [worker-setup] -> role home
"""
import os
import glob
import html

os.chdir(os.path.dirname(os.path.abspath(__file__)))


# ======================================================================
# Small building blocks
# ======================================================================
def Q(text):
    return html.escape(text, quote=True)


def T(en, hi):
    """Bilingual text. app.js swaps it when the language button is pressed."""
    return f'<span data-en="{Q(en)}" data-hi="{Q(hi)}">{html.escape(en)}</span>'


def H(en, hi):
    return f'<h2>{T(en, hi)}</h2>'


def AL(kind, en, hi, attrs=''):
    """Message box. kind: '' (red), 'ok' (green), 'warn' (yellow)."""
    return f'<div class="alert {kind}"{attrs}>{T(en, hi)}</div>'


def B(en, hi, to, cls='', attrs=''):
    """Big button that opens another page."""
    return f'<a class="btn {cls}" href="{to}.html"{attrs}>{T(en, hi)}</a>'


def IT(icon, en, hi, sub='', to='', tag='', attrs=''):
    """Card with an icon. Becomes a link when `to` is given."""
    tag_html = f'<span class="tag">{tag}</span>' if tag else ''
    inner = f'<div class="ic">{icon}</div><div><b>{T(en, hi)}</b><small>{sub}</small></div>{tag_html}'
    if not to:
        return f'<div class="card"{attrs}>{inner}</div>'
    return f'<a class="card" href="{to}.html"{attrs}>{inner}</a>'


def ROLE_CARD(icon, en, hi, sub_en, sub_hi, role):
    """Card on the role page. app.js saves the role in the database, then opens the right home page."""
    inner = f'<div class="ic">{icon}</div><div><b>{T(en, hi)}</b><small>{T(sub_en, sub_hi)}</small></div>'
    return f'<a class="card" href="#" data-role="{role}">{inner}</a>'


def ST(*stats):
    """Number boxes: (placeholder, english, hindi, bind_key). app.js fills data-bind from the database."""
    boxes = ''.join(
        f'<div class="stat"><b data-bind="{key}">{ph}</b>{T(en, hi)}</div>' for ph, en, hi, key in stats)
    return f'<div class="grid">{boxes}</div>'


def BAR(en, hi, key=''):
    """Empty bar chart; app.js (or weather.js) draws the bars."""
    ck = f' data-chart="{key}"' if key else ''
    return f'<div class="card bars"{ck} style="display:block">{H(en, hi)}<div class="empty">Loading…</div></div>'


def DONUT(en, hi, key):
    return (f'<div class="card" data-donut="{key}"><svg width="90" height="90" viewBox="0 0 36 36" role="img" aria-label="progress">'
            '<circle cx="18" cy="18" r="15.9" fill="none" stroke="#e6dcc0" stroke-width="4"/>'
            '<circle cx="18" cy="18" r="15.9" fill="none" stroke="#2F6B3A" stroke-width="4" stroke-dasharray="0 100" transform="rotate(-90 18 18)"/>'
            '<text x="18" y="21" text-anchor="middle" font-size="8" fill="#1B2A4A">0%</text></svg>'
            f'<b>{T(en, hi)}</b></div>')


def LIST(path):
    """Empty container; app.js fills it from /api<path> (and says "nothing yet" if the database has none)."""
    return f'<div class="list" data-list="{path}" aria-live="polite"><div class="empty">Loading…</div></div>'


def STEP(n):
    dots = ''.join(f'<i class="{"on" if i < n else ""}"></i>' for i in range(3))
    return f'<div class="steps" aria-hidden="true">{dots}</div>'


def FIELD(fid, en, hi, kind, placeholder, key='', src=''):
    """One label + input/select. `kind` is an <input> type, or 's' for a select (options separated by |)."""
    k = f' data-k="{key}"' if key else ''
    if kind == 's':
        options = f'<option value="">{placeholder}</option>' if src else ''.join(f'<option>{o}</option>' for o in placeholder.split('|'))
        s = f' data-src="{src}"' if src else ''
        control = f'<select id="{fid}"{k}{s} required>{options}</select>'
    else:
        rules = ''
        if kind == 'tel':
            if key == 'code':
                rules = ' pattern="[0-9]{6}" maxlength="6" inputmode="numeric" autocomplete="off"'
            else:
                rules = ' pattern="[0-9]{10}" maxlength="10" inputmode="numeric"'
        elif kind == 'password':
            rules = ' minlength="6" maxlength="72"'
        elif kind == 'number':
            rules = ' min="1"'
        elif kind == 'date':
            rules = ' data-date'
        control = f'<input id="{fid}" type="{kind}" placeholder="{Q(placeholder)}"{k}{rules} required>'
    return f'<div><label for="{fid}">{T(en, hi)}</label>{control}</div>'


_fid = [0]


def F(fields, en, hi, nxt, api='', method='POST', attrs=''):
    """Form. fields: (label_en, label_hi, type, placeholder, key[, select_source]).
    api: saved through the backend (e.g. '/fields'); without api the values wait in the browser for the next step."""
    rows = ''
    for label_en, label_hi, kind, placeholder, *rest in fields:
        _fid[0] += 1
        key = rest[0] if rest else ''
        src = rest[1] if len(rest) > 1 else ''
        rows += FIELD(f'f{_fid[0]}', label_en, label_hi, kind, placeholder, key, src)
    a = (f' data-api="{api}"' if api else '')
    if method != 'POST':
        a += f' data-method="{method}" data-prefill="{api}"'
    a += attrs
    return f'<form class="form" data-next="{nxt}.html"{a}>{rows}<button class="btn" type="submit">{T(en, hi)}</button></form>'


# Weather card (today, or the chosen booking day). app.js fills it from open-meteo.com.
WEATHER = (
    '<div class="card"><div class="ic">⛅</div><div><b><span id="t">--</span>°C · 🌧 <span id="r">--</span>%</b>'
    f'<small>{T("Weather forecast", "मौसम का पूर्वानुमान")}</small></div></div>'
    '<div id="wxa" class="alert" hidden>' + T('🌧 Rain expected — consider rescheduling outdoor work.',
                                              '🌧 बारिश की संभावना — बाहरी काम की तारीख बदलने पर विचार करें।') + '</div>')

LANG_BUTTON = '<button class="lang lang-float" id="lg" type="button" aria-label="Language">अ/A</button>'

# ======================================================================
# Bottom navigation per role
# ======================================================================
NAVS = {
    'F': [('farmer-home', '🏠', 'Home', 'होम'), ('machines', '🚜', 'Machines', 'मशीन'), ('workforce', '👥', 'Workers', 'मज़दूर'),
          ('bookings', '📋', 'Bookings', 'बुकिंग'), ('profile', '👤', 'Profile', 'प्रोफ़ाइल')],
    'O': [('owner-home', '🏠', 'Home', 'होम'), ('my-machines', '🚜', 'Machines', 'मशीन'), ('requests', '📥', 'Requests', 'अनुरोध'),
          ('earnings', '💰', 'Earnings', 'कमाई'), ('profile', '👤', 'Profile', 'प्रोफ़ाइल')],
    'W': [('worker-home', '🏠', 'Home', 'होम'), ('jobs', '🧾', 'Jobs', 'काम'), ('profile', '👤', 'Profile', 'प्रोफ़ाइल')],
}

PAGES = []


def pg(name, title_en, title_hi, nav, *body):
    """Register a page. nav: 'F' / 'O' / 'W' (that role's tabs), 'X' (tabs follow the user's role), None (no tabs)."""
    PAGES.append((name, title_en, title_hi, nav, ''.join(body)))


# ======================================================================
# 1. Login / register / SMS code / role   (nobody sees the app before this)
# ======================================================================
LOGIN = (
    LANG_BUTTON
    + '<img class="logo" alt="AgriHire logo" src="assets/logo.png" style="max-width:220px;border-radius:24px">'
    + H('Login', 'लॉगिन')
    + F([('Mobile number', 'मोबाइल नंबर', 'tel', '10-digit number', 'phone'),
         ('Password', 'पासवर्ड', 'password', '••••••', 'password')], 'Login', 'लॉगिन', 'role', '/auth/login')
    + B('Forgot password?', 'पासवर्ड भूल गए?', 'forgot', 'ghost')
    + B('Create new account', 'नया खाता बनाएँ', 'register', 'gold'))
pg('index', '', '', None, LOGIN)
pg('login', '', '', None, LOGIN)

pg('register', 'Create account', 'खाता बनाएँ', None,
   F([('Full name', 'पूरा नाम', 'text', 'Your name', 'name'),
      ('Mobile number', 'मोबाइल नंबर', 'tel', '10-digit number', 'phone'),
      ('Password', 'पासवर्ड', 'password', 'min 6 characters', 'password'),
      ('Village / Town', 'गाँव / शहर', 'text', 'Your village or town', 'village')],
     'Send SMS code', 'SMS कोड भेजें', 'otp', '/auth/register'))

pg('otp', 'Confirm mobile number', 'मोबाइल नंबर की पुष्टि', None,
   '<div class="alert warn">' + T('We sent a 6-digit code by SMS to', '6 अंकों का कोड SMS से भेजा गया:') + ' <b data-bind="pendingPhone"></b></div>',
   F([('SMS code', 'SMS कोड', 'tel', '6-digit code', 'code')], 'Confirm', 'पुष्टि करें', 'role', '/auth/verify', attrs=' data-with-phone'),
   '<button class="btn ghost" id="resend" type="button" disabled>' + T('Send the code again', 'कोड दोबारा भेजें') + '</button>')

pg('forgot', 'Reset password', 'पासवर्ड रीसेट', None,
   '<form class="form" id="forgot-1">'
   + FIELD('fg1', 'Mobile number', 'मोबाइल नंबर', 'tel', '10-digit number', 'phone')
   + '<button class="btn" type="submit">' + T('Send SMS code', 'SMS कोड भेजें') + '</button></form>',
   '<form class="form" id="forgot-2" hidden>'
   + AL('warn', 'Enter the code from the SMS and choose a new password.', 'SMS का कोड डालें और नया पासवर्ड चुनें।')
   + FIELD('fg2', 'SMS code', 'SMS कोड', 'tel', '6-digit code', 'code')
   + FIELD('fg3', 'New password', 'नया पासवर्ड', 'password', 'min 6 characters', 'password')
   + '<button class="btn" type="submit">' + T('Save new password', 'नया पासवर्ड सहेजें') + '</button></form>')

pg('role', 'Who are you?', 'आप कौन हैं?', None,
   AL('warn', 'Choose carefully. You cannot change this later.', 'ध्यान से चुनें। बाद में बदला नहीं जा सकता।'),
   ROLE_CARD('🧑‍🌾', 'Farmer', 'किसान', 'Book machinery and workers', 'मशीन और मज़दूर बुक करें', 'farmer'),
   ROLE_CARD('🚜', 'Machine owner', 'मशीन मालिक', 'Rent out your machines', 'अपनी मशीनें किराये पर दें', 'owner'),
   ROLE_CARD('👷', 'Worker', 'मज़दूर', 'Get hired for farm work', 'खेती के काम के लिए बुक हों', 'worker'))

# ======================================================================
# 2. Farmer
# ======================================================================
pg('farmer-home', 'Home', 'होम', 'F',
   WEATHER,
   ST(('–', 'Fields', 'खेत', 'fields'), ('–', 'Bookings', 'बुकिंग', 'bookings')),
   '<div class="grid">'
   + IT('🚜', 'Book machinery', 'मशीन बुक करें', '', 'machines')
   + IT('👥', 'Book workers', 'मज़दूर बुक करें', '', 'workforce')
   + IT('🌾', 'My fields', 'मेरे खेत', '', 'fields')
   + IT('📊', 'Dashboard', 'डैशबोर्ड', '', 'dashboard') + '</div>',
   IT('⛅', 'Weather forecast', 'मौसम का पूर्वानुमान', '', 'weather'),
   IT('💰', 'Compare prices', 'दाम की तुलना', '', 'price-compare'))

pg('machines', 'Machinery', 'मशीनें', 'F', LIST('/machines'), B('Compare prices', 'दाम की तुलना', 'price-compare', 'ghost'))
pg('machine-detail', 'Machine details', 'मशीन की जानकारी', 'F',
   '<h2 data-bind="item">–</h2><small data-bind="sub"></small>',
   ST(('–', 'Per hour', 'प्रति घंटा', 'rate'), ('–', 'Type', 'प्रकार', 'type')),
   AL('warn', 'The owner confirms your request. After that you see their phone number.', 'मालिक आपका अनुरोध पक्का करेगा। उसके बाद आपको उनका फ़ोन नंबर दिखेगा।'),
   B('Book now', 'अभी बुक करें', 'book-1', 'gold'))
pg('workforce', 'Workers', 'मज़दूर', 'F', LIST('/workers'))
pg('worker-detail', 'Worker details', 'मज़दूर की जानकारी', 'F',
   '<h2 data-bind="item">–</h2><small data-bind="sub"></small>',
   ST(('–', 'Per day', 'प्रति दिन', 'rate'), ('–', 'Team size', 'टीम', 'team')),
   AL('warn', 'The worker confirms your request. After that you see their phone number.', 'मज़दूर आपका अनुरोध पक्का करेंगे। उसके बाद आपको उनका फ़ोन नंबर दिखेगा।'),
   B('Book now', 'अभी बुक करें', 'book-1', 'gold'))

pg('book-1', 'Booking: field and work', 'बुकिंग: खेत और काम', 'F', STEP(1),
   F([('Field', 'खेत', 's', 'Loading…', 'field', '/fields'),
      ('Work', 'काम', 's', 'Tillage|Sowing|Harvesting|Weeding|Loading|Other', 'task')], 'Next', 'आगे', 'book-2'),
   B('Add a new field', 'नया खेत जोड़ें', 'field-add', 'ghost'))
pg('book-2', 'Booking: date and time', 'बुकिंग: तारीख और समय', 'F', STEP(2),
   F([('Date', 'तारीख', 'date', '', 'date'), ('Hours (machine) / Days (worker)', 'घंटे (मशीन) / दिन (मज़दूर)', 'number', '4', 'hrs')],
     'See the cost', 'खर्च देखें', 'book-3'))
pg('book-3', 'Booking: check', 'बुकिंग: जाँच', 'F', STEP(3),
   '<div class="card" style="display:block"><h2 id="bitem">—</h2><p>📅 <b id="bd">—</b> · ⏱ <b id="bh">—</b></p><h2 id="bc">—</h2></div>',
   WEATHER,
   AL('', '⚠ This date is already booked. Please pick another date.', '⚠ यह तारीख पहले से बुक है। दूसरी तारीख चुनें।', ' id="cf" hidden'),
   B('Change date', 'तारीख बदलें', 'book-2', 'ghost'),
   B('Send booking request', 'बुकिंग अनुरोध भेजें', 'book-done', 'gold', ' id="ok"'))
pg('book-done', 'Booking request', 'बुकिंग अनुरोध', 'F',
   '<div id="done" class="alert warn">' + T('Sending your request…', 'आपका अनुरोध भेजा जा रहा है…') + '</div>',
   AL('ok', '✅ Request sent. You will see the phone number as soon as it is confirmed.',
      '✅ अनुरोध भेज दिया गया। पक्का होते ही आपको फ़ोन नंबर दिखेगा।', ' id="bok" hidden'),
   B('My bookings', 'मेरी बुकिंग', 'bookings', 'gold'))
pg('bookings', 'My bookings', 'मेरी बुकिंग', 'F', LIST('/bookings'))
pg('booking-detail', 'Booking details', 'बुकिंग विवरण', 'X',
   '<h2 data-bind="item">–</h2>',
   ST(('–', 'Total', 'कुल', 'total'), ('–', 'Duration', 'अवधि', 'duration')),
   '<div id="bstatus" class="alert warn">–</div>',
   '<small data-bind="meta"></small>',
   '<div id="bcontact" class="card" hidden><div class="ic">📞</div><div><b data-bind="contactName"></b><small data-bind="contactPhone"></small></div></div>')

pg('fields', 'My fields', 'मेरे खेत', 'F', LIST('/fields'), B('Add field', 'खेत जोड़ें', 'field-add', 'gold'))
pg('field-add', 'Add field', 'खेत जोड़ें', 'F',
   F([('Field name', 'खेत का नाम', 'text', 'Example: North field', 'name'),
      ('Area (acre)', 'क्षेत्रफल (एकड़)', 'number', '2', 'area'),
      ('Crop', 'फ़सल', 's', 'Wheat|Rice|Maize|Sugarcane|Vegetables|Other', 'crop'),
      ('Location', 'जगह', 'text', 'Village or area', 'location')], 'Save field', 'खेत सहेजें', 'fields', '/fields'))
pg('price-compare', 'Compare prices', 'दाम की तुलना', 'F',
   BAR('Machine ₹ per hour', 'मशीन ₹ प्रति घंटा', 'price-machines'), BAR('Worker ₹ per day', 'मज़दूरी ₹ प्रति दिन', 'price-workers'))
pg('dashboard', 'Dashboard', 'डैशबोर्ड', 'F',
   ST(('–', 'Bookings', 'बुकिंग', 'bookings'), ('–', 'Spent', 'खर्च', 'amount')),
   BAR('Monthly spend ₹', 'मासिक खर्च ₹', 'spend'), DONUT('Bookings completed', 'पूरी हुई बुकिंग', 'done'))
pg('weather', 'Weather', 'मौसम', 'F', WEATHER,
   BAR('Rain chance % (5 days)', 'बारिश की संभावना % (5 दिन)'), BAR('Highest temperature °C', 'अधिकतम तापमान °C'))

# ======================================================================
# 3. Machine owner
# ======================================================================
pg('owner-home', 'Home', 'होम', 'O',
   ST(('–', 'My machines', 'मेरी मशीनें', 'machines'), ('–', 'This month', 'इस महीने', 'month')),
   BAR('Monthly earnings ₹', 'मासिक कमाई ₹', 'earn'),
   B('Add machine', 'मशीन जोड़ें', 'add-machine', 'gold'), B('Booking requests', 'बुकिंग अनुरोध', 'requests'))
pg('my-machines', 'My machines', 'मेरी मशीनें', 'O', LIST('/machines/mine'), B('Add machine', 'मशीन जोड़ें', 'add-machine', 'gold'))
pg('add-machine', 'Add machine', 'मशीन जोड़ें', 'O',
   F([('Type', 'प्रकार', 's', 'Tractor|Harvester|Rotavator|Seed drill|Thresher|Other', 'type'),
      ('Model / name', 'मॉडल / नाम', 'text', 'Example: Mahindra 575 DI', 'model'),
      ('Rate ₹ per hour', 'दर ₹ प्रति घंटा', 'number', '900', 'rate'),
      ('Location', 'जगह', 'text', 'Village or area', 'location')], 'Save', 'सहेजें', 'my-machines', '/machines'))
pg('requests', 'Booking requests', 'बुकिंग अनुरोध', 'O', LIST('/bookings/requests'))
pg('earnings', 'Earnings', 'कमाई', 'O',
   ST(('–', 'This month', 'इस महीने', 'month'), ('–', 'Total', 'कुल', 'amount')), BAR('Earnings ₹', 'कमाई ₹', 'earn'))

# ======================================================================
# 4. Worker
# ======================================================================
pg('worker-setup', 'My worker profile', 'मेरी मज़दूर प्रोफ़ाइल', 'W',
   AL('warn', 'Farmers can see and book you only after you save this profile.', 'यह प्रोफ़ाइल सहेजने के बाद ही किसान आपको देख और बुक कर पाएँगे।'),
   F([('Skill', 'कौशल', 's', 'Harvesting|Sowing|Weeding|Loading|General farm work', 'skill'),
      ('Daily wage ₹', 'दैनिक मज़दूरी ₹', 'number', '400', 'rate'),
      ('Village / Town', 'गाँव / शहर', 'text', 'Where you work', 'village'),
      ('People in your team (1 = only me)', 'टीम में लोग (1 = सिर्फ़ मैं)', 'number', '1', 'groupSize')],
     'Save profile', 'प्रोफ़ाइल सहेजें', 'worker-home', '/workers/me', 'PUT'))
pg('worker-home', 'Home', 'होम', 'W',
   ST(('–', 'Job requests', 'काम के अनुरोध', 'jobs'), ('–', 'Waiting', 'इंतज़ार में', 'pending')),
   '<div class="card" id="avail" role="button" tabindex="0" hidden><div class="ic">✅</div><div><b>' + T('Available for work', 'काम के लिए उपलब्ध')
   + '</b><small>' + T('Tap to switch on / off', 'चालू / बंद करने के लिए दबाएँ') + '</small></div><span class="tag" id="avail-tag">…</span></div>',
   LIST('/bookings/requests'), B('Edit my profile', 'मेरी प्रोफ़ाइल बदलें', 'worker-setup', 'ghost'))
pg('jobs', 'Job requests', 'काम के अनुरोध', 'W', LIST('/bookings/requests'))

# ======================================================================
# 5. Shared pages
# ======================================================================
pg('settings', 'Settings', 'सेटिंग', 'X',
   IT('📍', 'Location for weather', 'मौसम के लिए लोकेशन', '', 'location'),
   H('Text size', 'अक्षर का आकार'),
   '<div class="grid"><button class="btn" type="button" onclick="fs(-1)">A−</button><button class="btn" type="button" onclick="fs(1)">A+</button></div>',
   IT('🚪', 'Logout', 'लॉगआउट', '', 'index', '', ' data-logout'))
pg('location', 'Location', 'लोकेशन', 'X',
   AL('warn', 'Your location is used only to show the weather for your area.', 'आपकी लोकेशन सिर्फ़ आपके इलाके का मौसम दिखाने के लिए है।'),
   '<button class="btn navy" type="button" onclick="loc()">📍 ' + T('Detect my location', 'मेरी लोकेशन पता करें') + '</button><small id="ll"></small>')
pg('profile', 'Profile', 'प्रोफ़ाइल', 'X',
   '<img class="logo" alt="AgriHire" src="assets/mark.png" style="max-width:110px">',
   '<div class="card"><div class="ic">👤</div><div><b data-bind="name">–</b><small data-bind="phone"></small></div></div>',
   IT('✏', 'Edit profile', 'प्रोफ़ाइल बदलें', '', 'edit-profile'),
   IT('⚙', 'Settings', 'सेटिंग', '', 'settings'),
   IT('🆘', 'Help', 'मदद', '', 'help'),
   IT('ℹ', 'About', 'हमारे बारे में', '', 'about'))
pg('edit-profile', 'Edit profile', 'प्रोफ़ाइल बदलें', 'X',
   F([('Name', 'नाम', 'text', 'Your name', 'name'), ('Village / Town', 'गाँव / शहर', 'text', 'Your village or town', 'village')],
     'Save', 'सहेजें', 'profile', '/auth/me', 'PATCH'))
pg('help', 'Help', 'मदद', 'X',
   H('Farmer', 'किसान'),
   AL('', '1. Add your field. 2. Choose a machine or worker. 3. Pick the date. 4. After the owner confirms, call them.',
      '1. अपना खेत जोड़ें। 2. मशीन या मज़दूर चुनें। 3. तारीख चुनें। 4. मालिक के पक्का करने पर उन्हें फ़ोन करें।'),
   H('Machine owner', 'मशीन मालिक'),
   AL('', 'Add your machine with its hourly rate. Accept or decline requests on the Requests tab.',
      'अपनी मशीन और घंटे का दाम जोड़ें। अनुरोध टैब में स्वीकार या अस्वीकार करें।'),
   H('Worker', 'मज़दूर'),
   AL('', 'Fill your profile with skill and daily wage. Accept jobs on the Jobs tab.',
      'अपनी प्रोफ़ाइल में कौशल और दैनिक मज़दूरी भरें। काम टैब में काम स्वीकार करें।'))
pg('about', 'About AgriHire', 'एग्रीहायर के बारे में', 'X',
   '<img class="logo" alt="AgriHire logo" src="assets/logo.png">',
   AL('ok', 'Dev Shakya · Chahat Agrawal · Arjun Rathore — Hindustan College of Science & Technology, Mathura',
      'देव शाक्य · चाहत अग्रवाल · अर्जुन राठौर — हिंदुस्तान कॉलेज ऑफ साइंस एंड टेक्नोलॉजी, मथुरा'))


# ======================================================================
# Write the files
# ======================================================================
def nav_html(key, dynamic=False):
    links = ''.join(f'<a href="{p}.html"><span class="i">{i}</span>{T(en, hi)}</a>' for p, i, en, hi in NAVS[key])
    attr = f' data-nav="{key}" hidden' if dynamic else ''
    return f'<nav aria-label="Main"{attr}>{links}</nav>'


HEAD = ('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1"><title>AgriHire</title>'
        '<link rel="icon" href="assets/mark.png"><link rel="preconnect" href="https://fonts.googleapis.com">'
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
        '<link href="https://fonts.googleapis.com/css2?family=Mukta:wght@400;700&display=swap" rel="stylesheet">'
        '<link rel="stylesheet" href="style.css"></head>')

written = set()
for name, title_en, title_hi, nav, body in PAGES:
    if nav == 'X':
        tabs = ''.join(nav_html(k, True) for k in 'FOW')
    else:
        tabs = nav_html(nav) if nav else ''
    header = '' if not title_en else (
        '<header><a href="javascript:history.back()" aria-label="Back">←</a>'
        f'<h1>{T(title_en, title_hi)}</h1><button class="lang" id="lg" type="button" aria-label="Language">अ/A</button></header>')
    extra = '<script src="weather.js"></script>' if name == 'weather' else ''
    page = (f'{HEAD}<body data-page="{name}"><div class="app">{header}<main>{body}</main>{tabs}</div>'
            f'<noscript>Please turn on JavaScript.</noscript><script src="app.js"></script>{extra}</body></html>')
    with open(f'{name}.html', 'w', encoding='utf8') as f:
        f.write(page)
    written.add(f'{name}.html')

for old in glob.glob('*.html'):                      # pages from older versions
    if old not in written:
        os.remove(old)
        print('removed old page', old)
print(len(PAGES), 'pages written')
