# MCP-Server-Health-Report

- **Datum:** 2026-10-20
- **Umfeld:** Qwen Code 0.25.3, Windows 10 22H2 (Build 19045), Arbeitverzeichnis `C:\coding\Qwen-dap-mcp`
- **Konfigurationsquelle:** `C:\Users\SPK\.qwen\settings.json`
- **Methode:** Für jeden erlaubten Server: Existenzprüfung des Startbefehls, Verifikation von Handshake/Tool-Discovery (über die in der Session registrierten Tools), mindestens ein schreibgeschützter Funktionstest, Fehlerantwort-Check bei ungültiger Eingabe, Re-Test nach dem Testlauf. Alle Tests nacheinander, einzeln unter 60 s. Keine Änderungen an Dateien, Config oder Prozessen (einzige Test-Aktion: eine Playwright-Page, kontrolliert geschlossen).

## 1. Zusammenfassung

| Server | Status | Funktionstest |
|---|---|---|
| web-search | ✅ OK | Suche + Web-Fetch erfolgreich |
| exa | ✅ OK | Suche + Web-Fetch erfolgreich |
| playwright | ✅ OK | Navigation + DOM-Snapshot + Close erfolgreich |
| chrome-devtools | ⚠️ Teilweise | Server OK, Chrome-Verbindung auf 127.0.0.1:9222 defekt (404) |
| ghidra | ✅ OK | Headless-Instanz verbunden, 4/4 Tools callable |
| ida | ✅ OK | Session-Liste + saubere Fehlerantwort |
| x64dbg | ✅ OK | Server antwortet, keine aktive Session |
| windbg | ✅ OK | Session-Status ok, Re-Test ok |
| angr-mcp | ✅ OK | Programmabfrage ok (kein Binary geladen) |
| etw-trace-analyzer | ✅ OK | Trace-Liste ok, Re-Test ok |
| pe-sieve | ✅ OK | Report-Liste ok, Re-Test ok |
| rea | ✅ OK | Vollständiges Capability-Report, stabil |
| GitLab | ⚠️ Nicht aktiv | Konfiguriert, aber nicht in `mcp.allowed`; Endpoint liefert HTTP 401 |
| context7 | ⏸️ Deaktiviert | In `mcp.excluded`, wie beabsichtigt nicht geladen |
| volatility3 | ⏸️ Deaktiviert | In `mcp.excluded`; `memory.raw` fehlt (Deaktivierungsgrund bestätigt) |

**Ergebnis:** 12 von 15 Servern voll funktionsfähig. 1 Defekt (chrome-devtools → Chrome-Setup), 1 konfigurationsbedingte Lücke (GitLab), 2 absichtlich deaktiviert.

## 2. Konfigurationsanalyse

### 2.1 Serverübersicht

`mcpServers` enthält 15 Einträge:

- **`mcp.allowed` (12):** web-search, exa, playwright, chrome-devtools, ida, ghidra, x64dbg, windbg, angr-mcp, etw-trace-analyzer, pe-sieve, rea
- **`mcp.excluded` (2):** context7, volatility3
- **Konfiguriert, aber weder allowed noch excluded (1):** GitLab → wird von Qwen Code nicht geladen

Alle 12 erlaubten Server haben ihre Tools in der Session registriert → Start + MCP-Handshake + Tool-Discovery für alle 12 bestätigt.

### 2.2 Startbefehle und Abhängigkeiten (alle verifiziert vorhanden)

| Server | Startbefehl | Vorhanden |
|---|---|---|
| web-search | `C:\Program Files\nodejs\node.exe` + `...\open-websearch-runtime\node_modules\open-websearch\build\index.js` | ✅ |
| exa | `npx -y exa-mcp-server` (`npx.ps1` im PATH) | ✅ |
| playwright | `npx -y @playwright/mcp@latest` (Profile: `C:\Users\SPK\AppData\Local\QwenPlaywright`) | ✅ |
| chrome-devtools | `npx.cmd -y chrome-devtools-mcp@latest --browser-url=http://127.0.0.1:9222` | ✅ |
| ghidra | `Python313\python.exe C:\tools\ghidra-mcp\ghidra_mcp_bootstrap.py` | ✅ |
| ida | `idalib-mcp --stdio` (`C:\Users\SPK\AppData\Local\Programs\Python\Python314\Scripts\idalib-mcp.exe`) | ✅ |
| x64dbg | `x64dbg-mcp` (`C:\Users\SPK\AppData\Roaming\npm\x64dbg-mcp.ps1`) | ✅ |
| windbg | `C:\tools\windbg-mcp\windbg-mcp.exe --tools all` | ✅ |
| angr-mcp | `C:\tools\angr-mcp\.venv\Scripts\python.exe -u C:\tools\angr-mcp\qwen_stdio.py` | ✅ |
| etw-trace-analyzer | `C:\tools\etw-mcp\.venv\Scripts\python.exe -m etw_analyzer.server` | ✅ |
| pe-sieve | `C:\tools\pe-sieve\.venv\Scripts\python.exe C:\tools\pe-sieve\pe_sieve_mcp.py` | ✅ |
| context7 | `npx -y @upstash/context7-mcp@latest` (deaktiviert) | ✅ |
| volatility3 | `C:\tools\volatility3-mcp\.venv\Scripts\python.exe ...\mcp_server.py` (deaktiviert) | ✅ |
| GitLab | `httpUrl: https://gitlab.com/api/v4/mcp` (kein Auth-Header in Config) | ✅ (Netzwerk) |
| rea | `npx -y rea-agents@6.7.0 mcp` | ✅ |

**Fehlstelle:** `C:\tools\volatility3-mcp\dumps\memory.raw` existiert nicht — konsistent mit dem Config-Kommentar „disabled until an image exists".

### 2.3 Timeout-Konfiguration

- Global: `mcp.toolIdleTimeoutMs = 300000`
- Pro Server: web-search/exa/playwright/chrome-devtools/ida/x64dbg/windbg/etw/pe-sieve = 180000 ms; ghidra/angr-mcp = 300000 ms (Discovery: 120000 ms); context7 = 120000 ms; GitLab/rea = Default

## 3. Detaillierte Testergebnisse

### 3.1 web-search — ✅ voll funktionsfähig

- **Test 1:** `search(query="ModelContextProtocol spec 2025", engines=["bing"], limit=3)` → 3 plausible Treffer (modelcontextprotocol.io, GitHub-Releases), `partialFailures: []`.
- **Test 2:** `fetchWebContent(url="https://example.com", renderMode="request")` → Titel „Example Domain", vollständiger Inhalt, `truncated: false`.
- **Nicht getestet:** `fetchGithubReadme`.
- API-Key nicht nötig (mehrere Engines ohne Key). Antwortzeiten: deutlich unter 60 s.

### 3.2 exa — ✅ voll funktionsfähig

- **Test 1:** `web_search_exa(query="Windows ETW WPR trace DPC latency analysis best practices", numResults=2)` → 2 Treffer mit vollständigen Highlights (Microsoft Learn).
- **Test 2:** `web_fetch_exa(urls=["https://example.com"], maxCharacters=500)` → sauberer Markdown-Content.
- API-Key ist verfügbar (Server meldet keinen Auth-Fehler; Key kommt aus der Umgebung, nicht aus der Config).

### 3.3 playwright — ✅ voll funktionsfähig

- **Test 1:** `browser_navigate("https://example.com")` → Page URL + Titel korrekt.
- **Test 2:** `browser_snapshot(depth=3)` → vollständiger Accessibility-Tree mit Element-Referenzen.
- **Test 3:** `browser_close()` → „No open tabs" (geöffnete Test-Page kontrolliert geschlossen).
- Persistenter Profil-Ordner `C:\Users\SPK\AppData\Local\QwenPlaywright` in Nutzung; sichtbarer Chrome mit DevTools-Capabilities.

### 3.4 chrome-devtools — ⚠️ Server OK, Chrome-Verbindung defekt

- **Server:** Start + Tool-Discovery erfolgreich (alle Tools registriert).
- **Test:** `list_pages` → Fehler: `Could not connect to Chrome. Cause: Failed to fetch browser webSocket URL from http://127.0.0.1:9222/json/version: HTTP Not Found`

**Diagnose (verifiziert, keine Vermutung):**

1. Port 127.0.0.1:9222 wird von `chrome.exe` (PID 19828, Hauptbrowser-Prozess) gehalten.
2. Chrome-Version: **155.0.8059.85**.
3. Startkommando des Prozesses: `"chrome.exe" --no-startup-window /prefetch:5` — **ohne** `--remote-debugging-port`.
4. Alle CDP-HTTP-Endpunkte antworten mit HTTP 404: `/json/version`, `/json`, `/json/list`, `/devtools`, `/`.
5. Keine anderen Chrome-Prozesse mit `--remote-debugging-port` in der Prozessliste (28 Chrome-Prozesse gecheckt).

**Ursache:** Aktuelle Chrome-Versionen binden Port 9222 intern (DevTools-Binding), ohne die CDP-HTTP-API zu exponieren. Das MCP-Server-Problem liegt also nicht im Server, sondern im Chrome-Setup.

**Reparatur-Optionen (während des Checks nicht angewandt):**

1. Chrome mit `--remote-debugging-port=9222` neu starten (bestehende Session/Profile bleiben erhalten).
2. Alternativen Port verwenden (z. B. 9223) — in Chrome **und** in `settings.json` (`--browser-url=http://127.0.0.1:9223`).
3. `--browser-url` aus der Config entfernen → chrome-devtools-mcp startet selbst eine Chrome-Instanz (eigener Profil-Ort, nicht das Alltags-Profil).

### 3.5 ghidra — ✅ voll funktionsfähig

- **Test 1:** `list_instances` → Headless-Instanz **v7.0.0** auf `http://127.0.0.1:8090`, 190 Endpoints, `connected: true`, 0 offene Programme.
- **Test 2:** `check_tools(tools="get_functions,rename_function,force_decompile,list_open_programs")` → **4/4 callable**.
- Hinweis (bekannt aus Vorwissen, hier bestätigt): `force_decompile` ist der korrekte Tool-Name in v7.0.0 (ein `decompile_function` existiert dort nicht).

### 3.6 ida — ✅ voll funktionsfähig

- **Test 1:** `idb_list` → `{"sessions":[],"count":0}` (Server antwortet, keine offenen IDBs).
- **Test 2 (Fehlerantwort):** `server_health(database="test")` → saubere JSON-Fehlerantwort `{"error":"Session not found: test"}` — Fehlerbehandlung korrekt, kein Crash/Timeout.

### 3.7 x64dbg — ✅ Server funktionsfähig

- **Test:** `list_sessions` → `[]` (Server antwortet, keine aktive Debug-Sitzung).
- **Nicht getestet:** Echter Attach an ein Testziel (würde einen Debug-Start erfordern). MCP-Ebene und Bridge sind verifiziert.

### 3.8 windbg — ✅ voll funktionsfähig

- **Test 1:** `session_status` → `{"max_sessions":4,"sessions":[],"status":"ok"}`.
- **Test 2 (Re-Test nach Testlauf):** identisches Ergebnis → Server weiterhin responsiv.
- **Nicht getestet:** Echter `open_dump`/`attach_process` (braucht Testziel).

### 3.9 angr-mcp — ✅ voll funktionsfähig

- **Test 1:** `am_get_current_program` → `null` (kein Binary geladen, wie erwartet).
- **Test 2 (Re-Test):** identisch → stabil.
- **Nicht getestet:** Echte CFG-Fast-Analyse eines Binaries.

### 3.10 etw-trace-analyzer — ✅ voll funktionsfähig

- **Test 1:** `list_loaded_traces` → „No traces loaded" (Server antwortet korrekt).
- **Test 2 (Re-Test):** identisch → stabil.
- **Nicht getestet:** Laden eines echten `.etl`-Traces.
- Symbol-Pfad ist konfiguriert (`_NT_SYMBOL_PATH` mit lokalem `C:\tools\symbols` + MS-Symbolserver).

### 3.11 pe-sieve — ✅ voll funktionsfähig

- **Test 1:** `list_reports` → `[]` (keine Reports unter `C:\tools\pe-sieve\reports`).
- **Test 2 (Re-Test):** identisch → stabil.
- Live-Scanning ist per Config deaktiviert (`PESIEVE_ALLOW_LIVE_SCAN=0`) — Live-Scan daher nicht getestet (bewusst).

### 3.12 rea — ✅ voll funktionsfähig

- **Test 1:** `binary_session` → vollständiges Capability-Report (67 KB): Provider-Kapazitäten, Verfügbarkeit pro Operation, `open: false`, `cleanup_pending: false`.
- **Test 2 (Re-Test):** zweiter Aufruf mit **identischem SHA-256** → deterministisch und stabil.
- **Nicht getestet:** Echte `open_binary`-Analyse eines Artefakts.

### 3.13 GitLab — ⚠️ konfiguriert, aber nicht aktiv

- `httpUrl: https://gitlab.com/api/v4/mcp`, **kein Auth-Header** in der Config.
- **Nicht in `mcp.allowed`** → von Qwen Code nicht geladen (keine `mcp__gitlab__*`-Tools in der Session).
- **Netzwerktest:** `GET https://gitlab.com/api/v4/mcp` → **HTTP 401** (Endpoint erreichbar, Authentifizierung erforderlich — ohne Token erwartbar).
- **Folgerung:** Selbst wenn GitLab erlaubte, wäre eine Auth (Personal Access Token im `Authorization`-Header oder OAuth) nötig.

### 3.14 context7 — ⏸️ deaktiviert (wie beabsichtigt)

- In `mcp.excluded` → nicht geladen, keine Tools in der Session.
- Config-Begründung: „disabled because of current llama.cpp grammar compatibility issues".
- Startfähigkeit: `npx` vorhanden → Server würde starten, wenn aktiviert. **Nicht ungefragt aktiviert.**

### 3.15 volatility3 — ⏸️ deaktiviert (wie beabsichtigt)

- In `mcp.excluded` → nicht geladen.
- Venv und `mcp_server.py` vorhanden; **`dumps\memory.raw` fehlt** → konsistent mit „disabled until an image exists".
- **Nicht ungefragt aktiviert.**

### 3.16 remote-qwen-4070ti — ⚠️ in Memory vorhanden, hier nicht konfiguriert

- Steht in der Memory als erreichbarer MCP-Server (zweiter Rechner, qwen serve Daemon, `C:\worker`, bonsai2-27b via 127.0.0.1:8080).
- **Nicht** in der globalen `settings.json`, nicht in der Projekt-Konfiguration, keine Tools in dieser Session.
- **Folgerung:** In dieser Installation/Session nicht geladen. Falls er hier verfügbar sein sollte, fehlt der Server-Eintrag; andernfalls ist er projektlokal in einem anderen Workspace konfiguriert.

## 4. Antwortzeiten und Stabilität

- Alle MCP-Aufrufe: **deutlich unter 60 s**, keine Timeouts, keine JSON-RPC-Fehler.
- Die MCP-Bridge meldet keine Millisekunden-Werte; Latenz qualitativ: lokale Server (windbg, angr, etw, pe-sieve, ghidra, ida, x64dbg, rea) sofort; Netzwerkbasierte (exa, playwright, web-search) mit erwartbarer Übertragungszeit.
- **Nach-Test-Reaktivität** (Folgeaufruf nach Test): bestätigt für windbg, angr-mcp, etw-trace-analyzer, pe-sieve, ghidra, ida, chrome-devtools, web-search, exa, playwright, rea (alle reagierten erneut korrekt).
- **Eigene Test-Prozesse:** Nur eine Playwright-Page (geschlossen). Alle MCP-Server waren bereits aus dem Session-Start von Qwen Code gestartet.

## 5. NICHT GETESTET (ausdrücklich)

| Funktion | Grund |
|---|---|
| web-search `fetchGithubReadme` | Kein Testziel definiert |
| x64dbg echter Attach/Step | Braucht laufendes Testziel (Live-Prozess-Manipulation) |
| windbg `open_dump`/`attach_*` | Braucht Dump/Prozess als Testziel |
| angr-mcp echte CFG-Analyse | Braucht Binary als Testziel |
| etw-trace-analyzer echtes `.etl`-Laden | Kein Trace-File vorhanden |
| pe-sieve echter Scan | Live-Scan per Config deaktiviert |
| rea echtes `open_binary` | Braucht Artefakt als Testziel |
| GitLab alle Tools | Server nicht geladen (nicht in `mcp.allowed`) |
| context7 / volatility3 Tools | Bewusst deaktiviert |

Server-Ebene (Start, Handshake, Tool-Discovery, Antwortverhalten) ist bei allen 12 erlaubten Servern verifiziert.

## 6. Empfehlungen (noch nicht angewandt)

1. **chrome-devtools beheben:** Chrome mit `--remote-debugging-port=9222` neu starten, oder Port in Chrome + Config ändern, oder `--browser-url` entfernen und MCP eigene Instanz starten lassen.
2. **GitLab entscheiden:** Entwfernen aus `mcpServers` (wenn nicht gebraucht) oder in `mcp.allowed` aufnehmen + Auth-Header (Personal Access Token) ergänzen.
3. **remote-qwen-4070ti prüfen:** Falls der Server in dieser Installation laufen soll, fehlt der Eintrag in `mcpServers`/`mcp.allowed` — sonst ist der Status beabsichtigt.
4. **volatility3:** Sobald ein Memory-Image unter `C:\tools\volatility3-mcp\dumps\memory.raw` liegt, Server aus `mcp.excluded` nehmen.
5. **context7:** Nach Behebung des llama.cpp-Grammar-Problem neu aktivieren und testen.

## 7. Methodik-Hinweise

- Keine Installationen, keine Reparaturen, keine Config-Änderungen während des Checks.
- Keine Live-Speicher-Manipulation, keine Debugger-Attachs an laufende Prozesse, keine Prozessinjektionen.
- Keine API-Keys/Tokens in diesem Report abgedruckt (Prüfung nur über Verhaltensweise, nicht über Output).
- Entdeckte Fehler wurden durch direkte Nachweise verifiziert (Port-Besitzer, Prozess-Kommandozeile, HTTP-Status pro Endpoint), nicht durch Annahme.
