/*
 * OFFICE STANDARDS
 * ----------------
 * This is the one file to edit when the office standards change:
 * colours, line weights, label typography and the EN/DE glossary.
 * All sizes are in points (1 pt = 1/72 inch), the same unit as Illustrator.
 *
 * Values here were taken from the example competition diagrams and should be
 * checked against the official CMYK/RGB values of the office palette.
 */
window.STANDARDS = {
  // Font used for labels. The first family is loaded from Google Fonts in
  // index.html; exported SVGs keep the family name so Illustrator uses the
  // locally installed font.
  font: "'Roboto Condensed', 'Arial Narrow', Arial, sans-serif",
  fontExportName: "Roboto Condensed",

  label: {
    titleSize: 9,        // CAPS style: element name
    subSize: 7,          // CAPS style: material / description lines
    plainSize: 8,        // Plain style: all lines
    titleWeight: 500,
    lineHeight: 1.22,
    textColor: "#2b2b2b",
    leaderColor: "#3a3a3a",
    leaderWidth: 0.6,
    dotRadius: 2.4,
    gap: 4,              // space between leader end and text
    legendSize: 10,
    legendSwatch: 12,
  },

  /*
   * Element types. The order here is the drawing (layer) order:
   * first = bottom, last = top. Each type becomes a named group in the
   * exported SVG/PDF, so the architects get one group per material.
   *
   *   stroke / fill : colours           width : line weight in pt
   *   dash          : SVG dash pattern  swatch: colour shown in the legend
   *   band          : colours used when a member is drawn with a thickness
   *                   ("Member thickness" in the panel): fill + outline,
   *                   like the double-line members in the Haag diagrams.
   */
  types: {
    existing:       { name: { en: "Existing building", de: "Bestand" },      stroke: "#a0a0a0", fill: "#f2f2f2", width: 0.75, swatch: "#d6d6d6", dash: "4 2" },
    ground:         { name: { en: "Ground",          de: "Erdreich" },        stroke: "#cfcfcf", fill: "#e9e9e9", width: 0.5,  swatch: "#e9e9e9" },
    pile:           { name: { en: "Piles",           de: "Pfähle" },          stroke: "#b9b9b9", fill: "none",    width: 3,    swatch: "#b9b9b9" },
    foundation:     { name: { en: "Foundation",      de: "Gründung" },        stroke: "#555555", fill: "#666666", width: 0.5,  swatch: "#666666" },
    concrete:       { name: { en: "Concrete",        de: "Beton" },           stroke: "#6e6e6e", fill: "#ededed", width: 1,    swatch: "#ededed", band: { fill: "#c8c8c8", outline: "#6e6e6e" } },
    slab:           { name: { en: "Slab",            de: "Decke" },           stroke: "#5a5a5a", fill: "none",    width: 2,    swatch: "#5a5a5a", cap: "butt", band: { fill: "#c8c8c8", outline: "#6e6e6e" } },
    envelope:       { name: { en: "Building outline",de: "Gebäudeumriss" },   stroke: "#8c8c8c", fill: "none",    width: 0.6,  swatch: "#bdbdbd", dash: "2 2" },
    cladding:       { name: { en: "Steel envelope",  de: "Stahlhülle" },      stroke: "#5b5be8", fill: "#e4e4fa", width: 0.6,  swatch: "#c9c9f5" },
    timber:         { name: { en: "Timber",          de: "Holz" },            stroke: "#e38b12", fill: "none",    width: 2,    swatch: "#f39200", band: { fill: "#f39200", outline: "#6e6e6e" } },
    column:         { name: { en: "Column",          de: "Stütze" },          stroke: "#f6b13a", fill: "none",    width: 1.5,  swatch: "#fbb42f", band: { fill: "#fbb42f", outline: "#6e6e6e" } },
    column_thick:   { name: { en: "Column Thick",    de: "Stütze stark" },    stroke: "#f08a1c", fill: "none",    width: 2.5,  swatch: "#f7810f", band: { fill: "#f7810f", outline: "#6e6e6e" } },
    steel_light:    { name: { en: "Light steel",     de: "Leichtstahl" },     stroke: "#3c64d8", fill: "none",    width: 0.75, swatch: "#6f8fe6" },
    steel:          { name: { en: "Steel",           de: "Stahl" },           stroke: "#1f4fb8", fill: "none",    width: 2,    swatch: "#1e88e5", cap: "round", band: { fill: "#6f9be8", outline: "#1f4fb8" } },
    core_secondary: { name: { en: "Core (behind)",   de: "Kern (dahinter)" }, stroke: "#e8302d", fill: "#f9dada", width: 1,    swatch: "#f9dada", dash: "3 2" },
    core:           { name: { en: "Core",            de: "Kern" },            stroke: "#e8302d", fill: "#f7bdbd", width: 2,    swatch: "#ff0000" },
  },

  /*
   * Glossary of standard annotations. A label picked from here is filled in
   * in both languages at once, so switching EN/DE needs no retyping.
   * "sub" holds the material / description lines (one per line, use \n).
   */
  glossary: [
    { id: "core_walls", group: "Cores",
      en: { title: "Core", sub: "Reinforced Concrete Walls\nPrimary Vertical Load Transfer\nLateral Bracing" },
      de: { title: "Kernwände", sub: "Stahlbeton\nHauptlastabtragung vertikal\nHorizontale Aussteifung" } },
    { id: "core_walls_short", group: "Cores",
      en: { title: "Core Walls", sub: "Reinforced Concrete" },
      de: { title: "Kernwände", sub: "Stahlbeton" } },
    { id: "ebf_core", group: "Cores",
      en: { title: "Steel Eccentrically Braced Frame (EBF) Cores", sub: "Main lateral resisting system" },
      de: { title: "Exzentrisch ausgesteifte Stahlkerne (EBF)", sub: "Hauptaussteifungssystem" } },

    { id: "flat_slab", group: "Slabs",
      en: { title: "Flat Slab", sub: "Reinforced Concrete" },
      de: { title: "Flachdecke", sub: "Stahlbeton" } },
    { id: "tcc_slab", group: "Slabs",
      en: { title: "Regular Slab", sub: "Timber Concrete Composite Slab\nTimber Ribs and Plate\nThin Concrete Composite Topping\nIntegrated Services" },
      de: { title: "Regeldecke", sub: "Holz-Beton-Verbunddecke\nHolzrippen und Platte\nDünne Aufbetonschicht\nIntegrierte Haustechnik" } },
    { id: "hollow_core", group: "Slabs",
      en: { title: "Regular Basement Slab", sub: "Hollow Core Slab\nLightweight Prefabricated Elements" },
      de: { title: "Regeldecke Untergeschoss", sub: "Hohldielendecke\nLeichte Fertigteilelemente" } },
    { id: "rc_floors_walls", group: "Slabs",
      en: { title: "Substructure: Reinforced concrete floors and walls and columns", sub: "" },
      de: { title: "Unterbau: Decken, Wände und Stützen aus Stahlbeton", sub: "" } },

    { id: "columns_rc", group: "Columns",
      en: { title: "Columns", sub: "Reinforced Concrete" },
      de: { title: "Stützen", sub: "Stahlbeton" } },
    { id: "regular_column", group: "Columns",
      en: { title: "Regular Column", sub: "Circular Reinforced Concrete Section" },
      de: { title: "Regelstütze", sub: "Stahlbeton, Kreisquerschnitt" } },
    { id: "basement_columns", group: "Columns",
      en: { title: "Basement Concrete Columns", sub: "" },
      de: { title: "Stützen Untergeschoss", sub: "Stahlbeton" } },
    { id: "lobby_columns", group: "Columns",
      en: { title: "Lobby Columns", sub: "Composite" },
      de: { title: "Lobby Stützen", sub: "Verbund" } },
    { id: "hanger_columns", group: "Columns",
      en: { title: "Hanger Columns", sub: "Steel" },
      de: { title: "Hängerstützen", sub: "Stahl" } },
    { id: "v_columns", group: "Columns",
      en: { title: "V-Shaped Columns", sub: "Composite Prefab Elements\nCircular Hollow Steel Sections\nReinforced Concrete Fill" },
      de: { title: "V-Stützen", sub: "Verbund-Fertigteile\nStahlhohlprofile, rund\nBetonfüllung bewehrt" } },

    { id: "truss", group: "Steel",
      en: { title: "Truss", sub: "Steel" },
      de: { title: "Fachwerk", sub: "Stahl" } },
    { id: "facade_truss", group: "Steel",
      en: { title: "Facade Truss", sub: "Rectangle Hollow Steel Sections\nParallel Lightweight Steel Truss\nUpper Floor Large Span Areas" },
      de: { title: "Fassadenfachwerk", sub: "Rechteckige Stahlhohlprofile\nParalleles leichtes Stahlfachwerk\nWeitgespannte Bereiche Obergeschosse" } },
    { id: "roof_truss", group: "Steel",
      en: { title: "Steel Roof Truss", sub: "" },
      de: { title: "Stahldachfachwerk", sub: "" } },
    { id: "light_framing", group: "Steel",
      en: { title: "Lightweight Steel Framing", sub: "" },
      de: { title: "Leichte Stahlrahmenkonstruktion", sub: "" } },
    { id: "diagrid", group: "Steel",
      en: { title: "Lightweight steel diagrid", sub: "" },
      de: { title: "Leichtes Stahl-Diagrid", sub: "" } },
    { id: "exoskeleton", group: "Steel",
      en: { title: "Steel Exoskeleton", sub: "" },
      de: { title: "Stahl-Exoskelett", sub: "" } },

    { id: "transfer_wall", group: "Transfer",
      en: { title: "Transfer Wall", sub: "Reinforced Concrete" },
      de: { title: "Lastverteilungswand", sub: "Stahlbeton" } },

    { id: "raft_piles", group: "Foundations",
      en: { title: "Raft Foundation", sub: "With Piles" },
      de: { title: "Bodenplatte", sub: "Mit Pfählen" } },
    { id: "raft", group: "Foundations",
      en: { title: "Regular Raft Foundation", sub: "Reinforced In-Situ Concrete Slab" },
      de: { title: "Bodenplatte", sub: "Ortbeton, Stahlbeton" } },
    { id: "core_raft", group: "Foundations",
      en: { title: "Core Area Raft Foundation", sub: "Reinforced In-Situ Concrete Slab\nIncreased Thickness" },
      de: { title: "Bodenplatte Kernbereich", sub: "Ortbeton, Stahlbeton\nVerstärkte Plattendicke" } },
    { id: "sub_raft", group: "Foundations",
      en: { title: "Substructure: Reinforced concrete raft foundation", sub: "" },
      de: { title: "Unterbau: Bodenplatte aus Stahlbeton", sub: "" } },
    { id: "sub_piles", group: "Foundations",
      en: { title: "Substructure: Bored piles or Barettes or Caissons Foundation", sub: "" },
      de: { title: "Unterbau: Bohrpfähle, Schlitzwandelemente oder Senkkästen", sub: "" } },

    // Terms from the Haag competition (timber / concrete hybrid)
    { id: "timber_columns", group: "Timber",
      en: { title: "Timber Columns", sub: "" },
      de: { title: "Holzstützen", sub: "" } },
    { id: "timber_column_inclined", group: "Timber",
      en: { title: "Inclined Timber Column (Facade)", sub: "" },
      de: { title: "Holzstütze geneigt (Fassade)", sub: "" } },
    { id: "timber_roof_inclined", group: "Timber",
      en: { title: "Inclined Timber Roof", sub: "" },
      de: { title: "Holzdach geneigt", sub: "" } },
    { id: "roof_beam", group: "Timber",
      en: { title: "Roof Beam", sub: "" },
      de: { title: "Dachträger", sub: "" } },
    { id: "tcc_slab_short", group: "Slabs",
      en: { title: "Timber-Concrete Composite Slab", sub: "" },
      de: { title: "Holz-Beton-Verbunddecke", sub: "" } },
    { id: "tcc_intermediate", group: "Slabs",
      en: { title: "Intermediate Floor, Timber-Concrete Composite", sub: "" },
      de: { title: "Zwischendecke Holz-Beton-Verbund", sub: "" } },
    { id: "rc_slab", group: "Slabs",
      en: { title: "Reinforced Concrete Slab", sub: "" },
      de: { title: "Stahlbetondecke", sub: "" } },
    { id: "rc_columns", group: "Columns",
      en: { title: "Reinforced Concrete Columns", sub: "" },
      de: { title: "Stahlbetonstützen", sub: "" } },
    { id: "rc_v_columns", group: "Columns",
      en: { title: "Reinforced Concrete V-Columns", sub: "" },
      de: { title: "Stahlbeton-V-Stützen", sub: "" } },
    { id: "deep_beam", group: "Transfer",
      en: { title: "Reinforced Concrete Wall Beam (Deep Beam)", sub: "" },
      de: { title: "Stahlbetonscheibe (wandartiger Träger)", sub: "" } },
    { id: "door_opening", group: "Transfer",
      en: { title: "Door Opening", sub: "" },
      de: { title: "Türöffnung", sub: "" } },
    { id: "footing", group: "Foundations",
      en: { title: "Foundation", sub: "" },
      de: { title: "Fundament", sub: "" } },
    { id: "raft_haunched", group: "Foundations",
      en: { title: "Haunched Raft Foundation", sub: "" },
      de: { title: "Bodenplatte gevoutet", sub: "" } },
    { id: "existing_building", group: "Existing",
      en: { title: "Existing Building", sub: "" },
      de: { title: "Bestandsgebäude", sub: "" } },
  ],

  // Page presets in pt (landscape values, portrait is derived).
  pages: {
    A4: [841.89, 595.28],
    A3: [1190.55, 841.89],
    A2: [1683.78, 1190.55],
    A1: [2383.94, 1683.78],
  },
};
