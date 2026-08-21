/* ==========================================================================
   THE INSTALLED ICON OPENS THE APP, NOT THE DINOSAUR.

   Bryan and Michael have this installed from the Chrome prompt, so it launches
   in display-mode: standalone with no address bar and no browser menu. With no
   service worker there was nothing to serve the page from, so out of signal the
   icon opened the offline error page -- the whole app, gone, with no way even to
   read this morning's stops. That is the finding this file answers.

   WHAT IT DOES AND DOES NOT TOUCH, because a cache in the wrong place is worse
   than none:

     THE SHELL is precached -- the page, the vendored Supabase library, the
     manifest, the icons. That is what makes the icon open something.

     NAVIGATION IS NETWORK-FIRST. Online, the newest publish wins immediately and
     nobody has to be told to hold Shift and refresh. Offline, the cached page is
     served. Cache-first would have been simpler and would mean a published fix
     sits unseen on a tablet until the cache happened to turn over, which for an
     app that prints state records is the wrong trade.

     SUPABASE IS NEVER TOUCHED. Every database call goes to another origin, and
     this worker returns without calling respondWith for anything that is not
     same-origin -- so those requests are not intercepted, not cached, not
     replayed. Two reasons, and either alone is enough. A cached PostgREST reply
     is a customer's address and a pesticide record sitting in a cache on a
     device that lives in a truck. And a WRITE that a cache "handled" is a write
     the office believes landed -- this whole codebase is arranged around a
     refused write never looking like it worked, and a service worker is the
     easiest place in a web app to break that promise by accident.

   SO: THIS WORKER SERVES THE APP AND NOTHING ELSE -- and on its own that gets
   you an app that opens and says "Could not load the book", which is what Bryan
   saw in airplane mode on 20 August 2026. Opening to a sentence about failure is
   better than the dinosaur and is not what anybody wanted.
   The other half is in app.html: snapSave() writes a fortnight and the reference
   lists to localStorage after every good load, and start()'s catch falls back to
   it. Neither half is much use without the other, and this comment named that
   snapshot for a day before it existed -- if you are here because the app opens
   empty, check snapLoad() before you change anything in this file.
   ========================================================================== */

/* Stamped by tools/build_app.py from the built page's own hash, so a publish
   that changes one byte retires every old cache and one that changes nothing
   leaves them alone. Left as a literal here so this file runs unbuilt too. */
var VERSION = "95c2d9140980";
var CACHE = "ut-shell-" + VERSION;

/* RELATIVE, EVERY ONE. The app is published under /office-trial/app/ and is
   opened from file:// on the tablet as well; an absolute "/index.html" would be
   wrong in both places. */
var SHELL = [
  "./",
  "./index.html",
  "./supabase-2.45.4.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon-180.png"
];

self.addEventListener("install", function (e) {
  /* addAll is ALL-OR-NOTHING, and that is not what is wanted here: one icon
     renamed and the whole install fails, leaving no cache at all and the
     dinosaur back. Each entry is fetched on its own and a failure is allowed to
     pass, because a shell missing one icon still opens and a shell missing
     everything does not. */
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(SHELL.map(function (u) {
        return c.add(new Request(u, { cache: "reload" }))["catch"](function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        /* ours and not this version -- another app on the same origin keeps its
           caches, which matters because github.io is one origin for everything
           published under it. */
        if (k.indexOf("ut-shell-") === 0 && k !== CACHE) return caches["delete"](k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;

  /* NOT OURS: leave it entirely alone. No respondWith means the browser does
     exactly what it would have done with no worker installed at all. This is
     the line that keeps every Supabase call -- reads, writes and auth -- out of
     this file. */
  if (req.method !== "GET") return;
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;

  /* THE PAGE ITSELF: network first, cache second. */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(function (res) {
        /* ONLY A REAL ANSWER FROM OUR OWN ORIGIN GETS TO BE THE SHELL. This wrote
           whatever came back, with no test at all, while the sub-resource branch
           below guards on status and type -- an asymmetry with no reason behind
           it. A truck-stop captive portal answering 200 with its own sign-in
           page, or a host 5xx, would be written over the cached app; the next
           cold start with no signal would then open THAT, and the installed app
           has no address bar to escape it with.
           `basic` is the check that matters: an opaque or redirected response is
           somebody else's page wearing our URL. skipWaiting and clients.claim
           mean a later good load still replaces a bad cache, but only if the app
           can be reached to do the loading -- which is exactly what a poisoned
           shell takes away. */
        if (res && res.ok && res.type === "basic") {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put("./index.html", copy); });
        }
        return res;
      })["catch"](function () {
        return caches.match("./index.html").then(function (hit) {
          return hit || caches.match("./");
        });
      })
    );
    return;
  }

  /* EVERYTHING ELSE SAME-ORIGIN -- the library, the icons, the manifest. These
     are versioned by the cache name, so cache-first is right: they cannot go
     stale without the version changing, and reading them off the disk is what
     makes a cold start out of signal feel like the app rather than a wait. */
  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === "basic") {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })["catch"](function () { return caches.match("./index.html"); })
  );
});
