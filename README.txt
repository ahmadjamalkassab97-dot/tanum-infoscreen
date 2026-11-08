Tanum InfoScreen – uppdatering
================================

Den här uppdateringen innehåller:
1. Företagslogotypen från bilden du skickade, inbyggd direkt i worker.js.
2. Korrekt företagsnamn: Lysekils Buss.
3. Aktuellt väder för Tanum hämtas från Open-Meteo (temperatur + väderförhållanden).
4. Ny administratörskod: 1989.
5. Befintlig INFO_KV-lagring och bildgräns 12 MB är bevarade.

VIKTIGT FÖRE PUBLICERING
- Behåll samma Worker och samma INFO_KV-binding.
- Skapa INTE en ny KV-namespace.
- Ändra inte eller radera några befintliga poster i KV.
- Öppna Worker > Edit code och ersätt innehållet i worker.js med filen worker.js i paketet.
- Kontrollera att INFO_KV fortfarande är kopplad.
- Publicera (Deploy) först när du är redo.

Efter publicering:
- Öppna /admin och logga in med 1989.
- Kontrollera TV-sidan / och verifiera logotypen och vädret.
- Testa med ett tillfälligt inlägg och en bild innan du använder det skarpt.

Väder:
- Hämtas automatiskt från Open-Meteo för Tanum.
- Kräver att Worker kan göra utgående HTTPS-anrop till api.open-meteo.com.
- Vid nätverksfel visas "Väder saknas" i stället för رقم غير حقيقي.

Säkerhet:
- Administratörskoden i den här versionen är 1989. لا تشاركها مع السائقين.
