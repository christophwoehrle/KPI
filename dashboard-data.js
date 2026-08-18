/* Datengrundlage – leer. Das Dashboard startet ohne Daten und zeigt ausschließlich
   die hochgeladenen Excel-Dateien (Wochenberichte KW-XX-20XX.xlsx und Sägelinie Sh_XX_YY.xlsx). */
const DATA = {"weekly":[],"issues":[],"areaSummary":[],"landShares":[],"landPrices":[],"ytd":[],"orderWindow":[],"drying":[],"shipments":[],"sawlineReports":[],"countryComparison":[]};

/* Große Teildatensätze werden separat nachgeladen, um jede Datei handhabbar zu halten. */
DATA.salesBreakdown = (typeof SALES_BREAKDOWN !== "undefined") ? SALES_BREAKDOWN : [];
DATA.productionCurrent = (typeof PRODUCTION_CURRENT !== "undefined") ? PRODUCTION_CURRENT : [];
DATA.countryComparison = (typeof COUNTRY_COMPARISON !== "undefined") ? COUNTRY_COMPARISON : [];
DATA.sawlineReports = (typeof SAWLINE_REPORTS !== "undefined") ? SAWLINE_REPORTS : [];

/* Einkaufsdaten (fest hinterlegter Stammdatensatz aus Einkauf.xlsx, 2025 + 2026).
   purchasingHistory = alle Jahre; purchasing = Arbeits-Array des im Header gewählten Jahres. */
DATA.purchasingHistory = (typeof PURCHASING_HISTORY !== "undefined") ? PURCHASING_HISTORY : [];
DATA.purchasing = [];
