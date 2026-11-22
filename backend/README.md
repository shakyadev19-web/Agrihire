# AgriHire backend (Node.js + Express + MongoDB)

## 1. Run it
1. Start MongoDB:  `mongod --dbpath ~/agrihire-data`   (leave this window open)
2. In a second window, inside this `backend` folder:
   ```
   npm install            (first time only)
   cp .env.example .env   (first time only; then set JWT_SECRET)
   npm start
   ```
3. Open http://localhost:3000 (never double-click the HTML files).

## 2. Screens and order
Login / Register (first page) -> SMS code -> choose Farmer / Machine owner / Worker -> (worker: fill worker profile) -> home of that role.
A logged-in user goes straight to their home page. Pages of other roles are blocked (in the browser and again on the server).

## 3. SMS codes (OTP)
Set `SMS_PROVIDER` in `.env`:
| Value | What happens |
|---|---|
| `console` (default) | The code is printed in the terminal that runs `npm start`. Use this for testing at home. |
| `fast2sms` | Real SMS. Make an account at fast2sms.com, put the API key in `FAST2SMS_KEY`. |
| `twilio` | Real SMS. Fill `TWILIO_SID`, `TWILIO_TOKEN`, `TWILIO_FROM`. A trial account only sends to numbers you verified in Twilio. |

Rules: code has 6 random digits, valid 5 minutes, works once, 5 wrong tries then it is dead, new code only every 30 seconds,
max 10 code requests per IP per 15 minutes. Codes are stored hashed. Restart the server after changing `.env`.
The real-SMS providers could not be tested from the development sandbox: send yourself one test SMS before the demo.

## 4. What is saved (collections)
| Collection | Created when |
|---|---|
| users | someone registers (`verified` becomes true after the SMS code; `role` is chosen once) |
| otps | an SMS code is sent (deleted automatically after 5 minutes) |
| workers | a user with role "worker" saves the worker profile |
| machines | a user with role "owner" adds a machine |
| fields | a farmer adds a field |
| bookings | a farmer sends a booking request |

There is no demo data. Lists show "No machines registered yet" / "No workers registered yet" until real users add them.
On every start the server deletes leftovers of older demo versions (machines without owner, workers without account, old bookings).

## 5. Managing the data
* **Compass** (free GUI): connect to `mongodb://127.0.0.1:27017`, database `agrihire`.
* **mongosh examples**
  ```
  use agrihire
  db.users.find({}, {name:1, phone:1, role:1, verified:1})
  db.users.deleteOne({phone:"9876543210"})        // remove a test user (also delete their worker/machines/bookings)
  db.workers.find().pretty()
  db.bookings.find({status:"pending"})
  db.dropDatabase()                                // wipe everything (start fresh before the final demo)
  ```
* **Backup / restore:** `mongodump --uri "mongodb://127.0.0.1:27017/agrihire" --out backup` and `mongorestore --uri "mongodb://127.0.0.1:27017" backup`

## 6. Rules the server enforces
* Login needs a confirmed mobile number. Wrong password / unknown number give the same message.
* Role is chosen once and cannot be changed. Farmers: fields, bookings. Owners: machines, requests. Workers: worker profile, jobs.
* Price and owner of a booking come from the database. Nobody can book their own machine.
* Booking status: pending -> confirmed / cancelled, confirmed -> done / cancelled. Owner (or worker) decides; the farmer can only cancel.
* One active booking per machine/worker per day (unique database index).
* The other person's phone number is shown only after a booking is confirmed.

## 7. API summary (all need login except auth)
POST /api/auth/register, /verify, /resend, /login, /forgot, /reset · GET/PATCH /api/auth/me
GET/POST /api/fields · PUT/DELETE /api/fields/:id
GET /api/machines · GET /api/machines/mine · POST /api/machines
GET /api/workers · GET/PUT/PATCH /api/workers/me
GET /api/bookings · /requests · /check · /:id · POST /api/bookings · PATCH /api/bookings/:id
GET /api/stats?as=user|owner · GET /api/health

## 8. Not done
* Online payment, ratings, live GPS tracking, notifications (removed because they were only demo screens).
* Booking conflicts are per day, not per hour.
* `main.py` in this folder is empty and can be deleted (the backend is Node.js).
