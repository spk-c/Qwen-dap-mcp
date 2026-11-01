---
name: mcp-health-check
description: Vollständiger MCP-Server-Gesundheitscheck der Qwen-Code-Installation — Konfigurationsanalyse, schreibgeschützte Funktionstests pro Server, Fehlerdiagnose, verifizierte Ursachen.
source: auto-skill
extracted_at: '2026-10-20T21:43:29.929Z'
---

# MCP-Server-Gesundheitscheck

Anwenden, wenn der User die MCP-Server seiner Qwen-Code-Installation (~/.qwen\settings.json) auf echte Funktionsfähigkeit prüfen will — nicht nur ob „verbunden" angezeigt wird.

## Harte Regeln (User-Spezifikation)
- Max 60 s pro Funktionstest; ein hängender Test darf die ganze Sitzung nicht blockieren.
- Tests nacheinander, nicht parallel.
- Nur sichere, möglichst schreibgeschützte Aktionen. Keine Änderungen an Repos/Dateien/Configs, keine Debugger-Attachments, keine Live-Speicher-Manipulation, keine Installationen/Updates, keine automatischen Reparaturen, Auth-Checks nie umgehen.
- Nur Prozesse beenden, die der Check selbst gestartet hat (z. B. Playwright-Seite → browser_close).
- API-Keys/Tokens nie ausgeben.
- Nicht getestete Funktionen ausdrücklich als NICHT GETESTET kennzeichnen. Erfolgreiches Handshake/Tool-Discovery ≠ Funktionsnachweis.

## Phase 1 — Konfiguration analysieren
1. C:\Users\SPK\.qwen\settings.json komplett lesen.
2. Jeden mcpServers-Eintrag klassifizieren:
   - **aktiviert** = in mcp.allowed (Whitelist-Semantik: Server ohne Eintrag werden nicht geladen, z. B. GitLab)
   - **deaktiviert** = in mcp.excluded (Status nur prüfen, nicht aktivieren)
   - **nicht zugelassen** = in mcpServers, aber in keiner der Listen
3. Startbefehle verifizieren: Test-Path für explizite Pfade (node.exe, Venv-Pythons, .py-Skripte, .exe), Get-Command/where für PATH-Befehle (npx, idalib-mcp, x64dbg-mcp).
4. Start- + Handshake-Nachweis = Tools des Servers sind in der Session registriert (Deferred-Tool-Liste). Verifizierte Menge == erlaubte Menge abgleichen.

## Phase 2 — Funktionstests (schreibgeschützt, je ein Server)
MCP-Tools hier erst per tool_search (select:<name>) schema-reviewen, dann per tool_call aufrufen — Deferred Tools ohne Review werden abgelehnt; arguments muss ein Objekt sein (mind. {}).

Geprüfte sichere Probes (2026-10-20):
- web-search: search (kleine Query, limit 3) + fetchWebContent example.com (renderMode request)
- exa: web_search_exa (numResults 2) + web_fetch_exa example.com (kleines maxCharacters)
- playwright: browser_navigate example.com → browser_snapshot (depth begrenzt) → browser_close
- chrome-devtools: list_pages
- ghidra: list_instances + check_tools (Callability prüfen, z. B. get_functions,rename_function,force_decompile)
- ida: idb_list + server_health mit ungültiger Session (testet zusätzlich den Fehlerpfad — saubere JSON-Fehlerantwort erwartet)
- x64dbg: list_sessions
- windbg: session_status
- angr-mcp: am_get_current_program
- etw-trace-analyzer: list_loaded_traces
- pe-sieve: list_reports
- rea: binary_session (keine Args; erwartet großes Capability-JSON)
- HTTP-Server (GitLab o. ä.): Invoke-WebRequest an den Endpunkt — 401 = erreichbar, Auth nötig (nicht umgehen)

## Phase 3 — Nach-Test-Reaktivität
Bei jedem getesteten Server einen billigen zweiten Aufruf wiederholen (z. B. session_status, list_sessions), um nachweislich zu zeigen, dass der Server nach dem Test weiterhin reagiert.

## Bekannter Diagnosepfad — chrome-devtools „Could not connect to Chrome ... HTTP Not Found"
Chrome ≥ 155 kann 127.0.0.1:9222 OHNE --remote-debugging-port halten (interne DevTools-Binding) — dann liefern alle CDP-Endpunkte (/json/version, /json, /json/list, /devtools, /) HTTP 404.
Diagnose: Get-NetTCPConnection -LocalPort 9222 -State Listen → OwningProcess → Get-CimInstance Win32_Process -Filter „ProcessId=<pid>" → CommandLine auf --remote-debugging-port prüfen.
Fix-Optionen (erst User-Freigabe einholen): (1) Chrome mit --remote-debugging-port=9222 neu starten, (2) anderen Port in Chrome UND MCP-Arg, (3) --browser-url weglassen, damit das MCP eigene Chrome-Instanz startet.

## Phase 4 — Bericht
Tabelle pro Server: Status ✅/⚠️/⏸️ + konkret getestete Aufrufe + ausdrückliche NICHT-GETESTET-Liste (z. B. echte Attach-/Dump-Tests ohne Testziel). Bestätigte Ursachen (Evidenz: Port-Eigner, CommandLine, HTTP-Codes) von Vermutungen trennen. Keine Auto-Reparatur — Fixes nur vorschlagen.
