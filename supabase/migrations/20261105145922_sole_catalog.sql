CREATE SCHEMA sole;
CREATE ROLE sole_catalog_api LOGIN;
REVOKE ALL ON SCHEMA sole FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA sole TO sole_catalog_api;

CREATE TABLE sole.sneakers (
    id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY CHECK (id > 0),
    brand text NOT NULL CHECK (btrim(brand) <> ''),
    name text NOT NULL CHECK (btrim(name) <> ''),
    year integer CHECK (year BETWEEN 1800 AND 2200),
    descriptive_overview text NOT NULL CHECK (btrim(descriptive_overview) <> ''),
    gender_target text NOT NULL CHECK (gender_target IN ('Men', 'Women', 'Both')),
    retail_price text NOT NULL CHECK (btrim(retail_price) <> ''),
    colorway text NOT NULL CHECK (btrim(colorway) <> ''),
    description text NOT NULL CHECK (btrim(description) <> ''),
    category text NOT NULL CHECK (category IN ('Basketball', 'Running', 'Lifestyle', 'Football')),
    details_specifications text NOT NULL CHECK (btrim(details_specifications) <> ''),
    shoe_reference_number text NOT NULL UNIQUE CHECK (btrim(shoe_reference_number) <> ''),
    review_stars double precision NOT NULL CHECK (review_stars BETWEEN 0 AND 5),
    materials text NOT NULL CHECK (btrim(materials) <> ''),
    country_of_origin text NOT NULL CHECK (btrim(country_of_origin) <> ''),
    closure_type text NOT NULL CHECK (closure_type IN ('Lace-up', 'Laceless', 'Slip-on', 'Hook-and-loop', 'Not documented')),
    cut text NOT NULL CHECK (cut IN ('Low', 'Mid', 'High', 'Not documented')),
    sole_material text NOT NULL CHECK (btrim(sole_material) <> ''),
    cushioning text NOT NULL CHECK (btrim(cushioning) <> ''),
    weight_g double precision CHECK (weight_g > 0 AND weight_g < 'Infinity'::double precision),
    release_month integer CHECK (release_month BETWEEN 1 AND 12),
    image_url text NOT NULL CHECK (btrim(image_url) <> ''),
    image_note text NOT NULL DEFAULT '',
    provenance jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(provenance) = 'object')
);

ALTER TABLE sole.sneakers ENABLE ROW LEVEL SECURITY;
CREATE POLICY catalog_api_access ON sole.sneakers TO sole_catalog_api USING (true) WITH CHECK (true);
REVOKE ALL ON sole.sneakers FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sole.sneakers TO sole_catalog_api;
GRANT USAGE ON SEQUENCE sole.sneakers_id_seq TO sole_catalog_api;

INSERT INTO sole.sneakers (id, image_url, image_note, provenance, brand, name, year, descriptive_overview, gender_target, retail_price, colorway, description, category, details_specifications, shoe_reference_number, review_stars, materials, country_of_origin, closure_type, cut, sole_material, cushioning, weight_g, release_month) OVERRIDING SYSTEM VALUE
SELECT id, image_url, image_note, provenance, brand, name, year, descriptive_overview, gender_target, retail_price, colorway, description, category, details_specifications, shoe_reference_number, review_stars, materials, country_of_origin, closure_type, cut, sole_material, cushioning, weight_g, release_month FROM jsonb_populate_recordset(
    NULL::sole.sneakers, $catalog$[
  {
    "id": 1,
    "image_url": "images/1.jpg",
    "image_note": "",
    "provenance": {
      "shoe_reference_number": {
        "status": "verified",
        "sources": [
          "https://www.goat.com/sneakers/air-jordan-1-retro-high-og-chicago-555088-101"
        ],
        "note": "Reference number is for the 2015 Chicago retro; the supplied 1985 archive year is retained as the silhouette reference year."
      },
      "review_stars": {
        "status": "mock",
        "sources": [],
        "note": "Realistic demonstration rating; not an aggregate of actual customer reviews."
      },
      "country_of_origin": {
        "status": "provided",
        "sources": [],
        "note": "Country of Origin from the supplied reference; not a verified manufacturing location."
      },
      "checked_on": "2026-10-09",
      "closure_type": {
        "status": "observed",
        "sources": [
          "https://www.nike.com.br/tenis-nike-air-jordan-i-high-og-unissex-016521.html"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "cut": {
        "status": "observed",
        "sources": [
          "https://www.nike.com.br/tenis-nike-air-jordan-i-high-og-unissex-016521.html"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "sole_material": {
        "status": "verified",
        "sources": [
          "https://www.nike.com.br/tenis-nike-air-jordan-i-high-og-unissex-016521.html"
        ],
        "note": "Manufacturer specification for the named model/current reference edition."
      },
      "cushioning": {
        "status": "verified",
        "sources": [
          "https://www.nike.com.br/tenis-nike-air-jordan-i-high-og-unissex-016521.html"
        ],
        "note": "Manufacturer specification for the named model/current reference edition."
      },
      "weight_g": {
        "status": "estimated",
        "sources": [
          "https://www.nike.com.br/tenis-nike-air-jordan-i-high-og-unissex-016521.html"
        ],
        "note": "Approx. per shoe, men's US 9; estimate from structured court upper, rubber outsole and impact cushioning. Actual weight varies by size and edition."
      },
      "release_month": {
        "status": "verified",
        "sources": [
          "https://www.goat.com/sneakers/air-jordan-1-retro-high-og-chicago-555088-101"
        ],
        "note": "2015 Chicago reference edition; archive year is the original silhouette year.",
        "release_year": 2015
      }
    },
    "brand": "Nike",
    "name": "Air Jordan 1 Retro High OG",
    "year": 1985,
    "descriptive_overview": "The sneaker that launched the Jordan line.",
    "gender_target": "Men",
    "retail_price": "₱13,000",
    "colorway": "Red / White / Black / Cream",
    "description": "The sneaker that launched the Jordan line. Listed in the basketball collection. Further product background has not been supplied.",
    "category": "Basketball",
    "details_specifications": "Leather upper; rubber outsole; high-top profile with lace-up closure.",
    "shoe_reference_number": "555088-101",
    "review_stars": 4.8,
    "materials": "Leather; Rubber",
    "country_of_origin": "United States",
    "closure_type": "Lace-up",
    "cut": "High",
    "sole_material": "Rubber cupsole",
    "cushioning": "Encapsulated Nike Air-Sole heel unit",
    "weight_g": 420.0,
    "release_month": 5
  },
  {
    "id": 2,
    "image_url": "images/2.jpg",
    "image_note": "",
    "provenance": {
      "shoe_reference_number": {
        "status": "verified",
        "sources": [
          "https://www.goat.com/sneakers/yeezy-boost-350-v2-zebra-cp9654"
        ],
        "note": "Reference number is for the Zebra release from 2017 and subsequent restocks; the supplied archive year is retained."
      },
      "review_stars": {
        "status": "mock",
        "sources": [],
        "note": "Realistic demonstration rating; not an aggregate of actual customer reviews."
      },
      "country_of_origin": {
        "status": "provided",
        "sources": [],
        "note": "Country of Origin from the supplied reference; not a verified manufacturing location."
      },
      "checked_on": "2026-10-09",
      "closure_type": {
        "status": "observed",
        "sources": [
          "https://preview.thenewsmarket.com/Previews/ADID/DocumentAssets/457525_v2.pdf"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "cut": {
        "status": "observed",
        "sources": [
          "https://preview.thenewsmarket.com/Previews/ADID/DocumentAssets/457525_v2.pdf"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "sole_material": {
        "status": "verified",
        "sources": [
          "https://preview.thenewsmarket.com/Previews/ADID/DocumentAssets/457525_v2.pdf"
        ],
        "note": "Manufacturer specification for the named model/current reference edition."
      },
      "cushioning": {
        "status": "verified",
        "sources": [
          "https://preview.thenewsmarket.com/Previews/ADID/DocumentAssets/457525_v2.pdf"
        ],
        "note": "Manufacturer specification for the named model/current reference edition."
      },
      "weight_g": {
        "status": "estimated",
        "sources": [
          "https://preview.thenewsmarket.com/Previews/ADID/DocumentAssets/457525_v2.pdf"
        ],
        "note": "Approx. per shoe, men's US 9; estimate from casual upper construction, rubber outsole and footbed. Actual weight varies by size and edition."
      },
      "release_month": {
        "status": "verified",
        "sources": [
          "https://www.goat.com/sneakers/yeezy-boost-350-v2-zebra-cp9654"
        ],
        "note": "Initial 2017 Zebra reference release; later restocks excluded.",
        "release_year": 2017
      }
    },
    "brand": "Adidas",
    "name": "Yeezy Boost 350 V2",
    "year": 2016,
    "descriptive_overview": "A Kanye West collaboration.",
    "gender_target": "Both",
    "retail_price": "₱12,000",
    "colorway": "Black",
    "description": "A Kanye West collaboration. Listed in the lifestyle collection. Further product background has not been supplied.",
    "category": "Lifestyle",
    "details_specifications": "Primeknit upper; Boost foam cushioning; rubber outsole.",
    "shoe_reference_number": "CP9654",
    "review_stars": 4.6,
    "materials": "Primeknit; Boost foam; Rubber",
    "country_of_origin": "Germany",
    "closure_type": "Lace-up",
    "cut": "Low",
    "sole_material": "Rubber outsole",
    "cushioning": "Full-length adidas BOOST foam",
    "weight_g": 350.0,
    "release_month": 2
  },
  {
    "id": 3,
    "image_url": "images/3.jpg",
    "image_note": "",
    "provenance": {
      "shoe_reference_number": {
        "status": "verified",
        "sources": [
          "https://www.nike.com/my/t/air-force-1-07-shoes-WrLlWX/CW2288-111"
        ],
        "note": "Reference number is for the modern men's Air Force 1 '07 White/White; 1982 remains the supplied silhouette year."
      },
      "review_stars": {
        "status": "verified",
        "sources": [
          "https://www.nike.com/my/t/air-force-1-07-shoes-WrLlWX/CW2288-111"
        ],
        "note": "Nike product-page aggregate: 4.8/5; may combine reviews across sizes and colorways."
      },
      "country_of_origin": {
        "status": "provided",
        "sources": [],
        "note": "Country of Origin from the supplied reference; not a verified manufacturing location."
      },
      "checked_on": "2026-10-09",
      "closure_type": {
        "status": "observed",
        "sources": [
          "https://www.nike.com/t/air-force-1-07-mens-shoes-DZejrQoC/CW2288-111"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "cut": {
        "status": "observed",
        "sources": [
          "https://www.nike.com/t/air-force-1-07-mens-shoes-DZejrQoC/CW2288-111"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "sole_material": {
        "status": "verified",
        "sources": [
          "https://www.nike.com/t/air-force-1-07-mens-shoes-DZejrQoC/CW2288-111"
        ],
        "note": "Manufacturer specification for the named model/current reference edition."
      },
      "cushioning": {
        "status": "verified",
        "sources": [
          "https://www.nike.com/t/air-force-1-07-mens-shoes-DZejrQoC/CW2288-111"
        ],
        "note": "Manufacturer specification for the named model/current reference edition."
      },
      "weight_g": {
        "status": "estimated",
        "sources": [
          "https://www.nike.com/t/air-force-1-07-mens-shoes-DZejrQoC/CW2288-111"
        ],
        "note": "Approx. per shoe, men's US 9; estimate from casual upper construction, rubber outsole and footbed. Actual weight varies by size and edition."
      },
      "release_month": {
        "status": "verified",
        "sources": [
          "https://www.goat.com/en-ca/sneakers/air-force-1-07-triple-white-cw2288-111"
        ],
        "note": "2020 White/White reference edition; archive year is the 1982 silhouette debut.",
        "release_year": 2020
      }
    },
    "brand": "Nike",
    "name": "Air Force 1 Low",
    "year": 1982,
    "descriptive_overview": "An all-white low-top classic and one of the best-selling sneakers of all time.",
    "gender_target": "Men",
    "retail_price": "₱7,000",
    "colorway": "White",
    "description": "An all-white low-top classic and one of the best-selling sneakers of all time. Listed in the lifestyle collection. Further product background has not been supplied.",
    "category": "Lifestyle",
    "details_specifications": "Leather upper with toe perforations; Nike Air cushioning; foam midsole; rubber outsole.",
    "shoe_reference_number": "CW2288-111",
    "review_stars": 4.8,
    "materials": "Leather; Foam; Rubber",
    "country_of_origin": "United States",
    "closure_type": "Lace-up",
    "cut": "Low",
    "sole_material": "Rubber outsole",
    "cushioning": "Nike Air cushioning with foam midsole",
    "weight_g": 465.0,
    "release_month": 12
  },
  {
    "id": 4,
    "image_url": "images/4.jpg",
    "image_note": "",
    "provenance": {
      "shoe_reference_number": {
        "status": "verified",
        "sources": [
          "https://www.sneakerfiles.com/new-balance-550-white-green-bb550wt1-release-date-info/"
        ],
        "note": "Reference number is for the 2021 White/Green release; 1989 remains the supplied silhouette year."
      },
      "review_stars": {
        "status": "mock",
        "sources": [],
        "note": "Realistic demonstration rating; not an aggregate of actual customer reviews."
      },
      "country_of_origin": {
        "status": "provided",
        "sources": [],
        "note": "Country of Origin from the supplied reference; not a verified manufacturing location."
      },
      "checked_on": "2026-10-09",
      "closure_type": {
        "status": "observed",
        "sources": [
          "https://www.newbalance.com/pd/550/BB550V1-52598.html"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "cut": {
        "status": "observed",
        "sources": [
          "https://www.newbalance.com/pd/550/BB550V1-52598.html"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "sole_material": {
        "status": "verified",
        "sources": [
          "https://www.newbalance.com/pd/550/BB550V1-52598.html"
        ],
        "note": "Manufacturer specification for the named model/current reference edition."
      },
      "cushioning": {
        "status": "estimated",
        "sources": [
          "https://www.newbalance.com/pd/550/BB550V1-52598.html"
        ],
        "note": "Construction estimate based on the supplied model and category; exact pictured edition is unverified."
      },
      "weight_g": {
        "status": "estimated",
        "sources": [
          "https://www.newbalance.com/pd/550/BB550V1-52598.html"
        ],
        "note": "Approx. per shoe, men's US 9; estimate from casual upper construction, rubber outsole and footbed. Actual weight varies by size and edition."
      },
      "release_month": {
        "status": "verified",
        "sources": [
          "https://www.goat.com/sneakers/550-white-green-bb550wt1"
        ],
        "note": "2021 White/Green reference edition; archive year is the 1989 silhouette debut.",
        "release_year": 2021
      }
    },
    "brand": "New Balance",
    "name": "550",
    "year": 1989,
    "descriptive_overview": "A retro basketball silhouette that became a streetwear staple.",
    "gender_target": "Both",
    "retail_price": "₱6,500",
    "colorway": "White / Black / Light Grey",
    "description": "A retro basketball silhouette that became a streetwear staple. Listed in the lifestyle collection. Further product background has not been supplied.",
    "category": "Lifestyle",
    "details_specifications": "Leather and mesh upper; rubber outsole; lace-up closure.",
    "shoe_reference_number": "BB550WT1",
    "review_stars": 4.5,
    "materials": "Leather; Mesh; Rubber",
    "country_of_origin": "United States",
    "closure_type": "Lace-up",
    "cut": "Low",
    "sole_material": "Rubber cupsole",
    "cushioning": "Foam wedge and cushioned footbed",
    "weight_g": 495.0,
    "release_month": 6
  },
  {
    "id": 5,
    "image_url": "images/5.jpg",
    "image_note": "",
    "provenance": {
      "shoe_reference_number": {
        "status": "verified",
        "sources": [
          "https://www.converse.com/shop/p/chuck-taylor-all-star-canvas-unisex-high-top-shoe/M9160_070.html"
        ],
        "note": "Reference number matches the catalog model and colorway; the pictured batch has not been authenticated."
      },
      "review_stars": {
        "status": "verified",
        "sources": [
          "https://www.namshi.com/saudi-en/buy-converse-chuck-taylor-all-star/Z033F8697C8D54F34CA7EZ/p/"
        ],
        "note": "Namshi product-page aggregate: 4.9/5 from 21 ratings on the M9160 listing."
      },
      "country_of_origin": {
        "status": "provided",
        "sources": [],
        "note": "Country of Origin from the supplied reference; not a verified manufacturing location."
      },
      "checked_on": "2026-10-09",
      "closure_type": {
        "status": "observed",
        "sources": [
          "https://www.converse.com/shop/p/chuck-taylor-all-star-canvas-unisex-high-top-shoe/M9160_095.html"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "cut": {
        "status": "observed",
        "sources": [
          "https://www.converse.com/shop/p/chuck-taylor-all-star-canvas-unisex-high-top-shoe/M9160_095.html"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "sole_material": {
        "status": "verified",
        "sources": [
          "https://www.converse.com/shop/p/chuck-taylor-all-star-canvas-unisex-high-top-shoe/M9160_095.html"
        ],
        "note": "Manufacturer specification for the named model/current reference edition."
      },
      "cushioning": {
        "status": "verified",
        "sources": [
          "https://www.converse.com/shop/p/chuck-taylor-all-star-canvas-unisex-high-top-shoe/M9160_095.html"
        ],
        "note": "Manufacturer specification for the named model/current reference edition."
      },
      "weight_g": {
        "status": "estimated",
        "sources": [
          "https://www.converse.com/shop/p/chuck-taylor-all-star-canvas-unisex-high-top-shoe/M9160_095.html"
        ],
        "note": "Approx. per shoe, men's US 9; estimate from casual upper construction, rubber outsole and footbed. Actual weight varies by size and edition."
      },
      "release_month": {
        "status": "estimated",
        "sources": [],
        "note": "Estimated spring catalog window for the current classic; not a confirmed 1922 launch month."
      }
    },
    "brand": "Converse",
    "name": "Chuck Taylor All Star",
    "year": 1922,
    "descriptive_overview": "One of the most recognizable sneakers ever made.",
    "gender_target": "Both",
    "retail_price": "₱4,000",
    "colorway": "Black / White / Blue / Red",
    "description": "One of the most recognizable sneakers ever made. Listed in the lifestyle collection. Further product background has not been supplied.",
    "category": "Lifestyle",
    "details_specifications": "Canvas upper; rubber toe cap and outsole; high-top lace-up construction.",
    "shoe_reference_number": "M9160",
    "review_stars": 4.9,
    "materials": "Canvas; Rubber",
    "country_of_origin": "United States",
    "closure_type": "Lace-up",
    "cut": "High",
    "sole_material": "Vulcanized rubber outsole",
    "cushioning": "OrthoLite cushioned insole (current edition)",
    "weight_g": 410.0,
    "release_month": 3
  },
  {
    "id": 6,
    "image_url": "images/6.jpg",
    "image_note": "",
    "provenance": {
      "shoe_reference_number": {
        "status": "verified",
        "sources": [
          "https://www.adidas.co.il/en/adizero-evo-sl-shoes/JH6206.html"
        ],
        "note": "Reference number matches the catalog model and colorway; the pictured batch has not been authenticated."
      },
      "review_stars": {
        "status": "verified",
        "sources": [
          "https://www.scheels.com/p/19831906608"
        ],
        "note": "SCHEELS product-family aggregate: 4.7/5 for JH6206; may combine sizes and colorways."
      },
      "country_of_origin": {
        "status": "provided",
        "sources": [],
        "note": "Country of Origin from the supplied reference; not a verified manufacturing location."
      },
      "checked_on": "2026-10-09",
      "closure_type": {
        "status": "observed",
        "sources": [
          "https://news.adidas.com/running/adizero-adios-pro-4-leads-the-way-as-adidas-introduces-new-race-and-training-silhouettes-to-its-awar/S/ecd0a1fe-e467-4f81-a767-0a64ab29d98f"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "cut": {
        "status": "observed",
        "sources": [
          "https://news.adidas.com/running/adizero-adios-pro-4-leads-the-way-as-adidas-introduces-new-race-and-training-silhouettes-to-its-awar/S/ecd0a1fe-e467-4f81-a767-0a64ab29d98f"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "sole_material": {
        "status": "verified",
        "sources": [
          "https://news.adidas.com/running/adizero-adios-pro-4-leads-the-way-as-adidas-introduces-new-race-and-training-silhouettes-to-its-awar/S/ecd0a1fe-e467-4f81-a767-0a64ab29d98f"
        ],
        "note": "Manufacturer specification for the named model/current reference edition."
      },
      "cushioning": {
        "status": "verified",
        "sources": [
          "https://news.adidas.com/running/adizero-adios-pro-4-leads-the-way-as-adidas-introduces-new-race-and-training-silhouettes-to-its-awar/S/ecd0a1fe-e467-4f81-a767-0a64ab29d98f"
        ],
        "note": "Manufacturer specification for the named model/current reference edition."
      },
      "weight_g": {
        "status": "verified",
        "sources": [
          "https://news.adidas.com/running/adizero-adios-pro-4-leads-the-way-as-adidas-introduces-new-race-and-training-silhouettes-to-its-awar/S/ecd0a1fe-e467-4f81-a767-0a64ab29d98f"
        ],
        "note": "Approx. 224 g per shoe, UK 8.5; adidas published specification."
      },
      "release_month": {
        "status": "verified",
        "sources": [
          "https://news.adidas.com/running/adizero-adios-pro-4-leads-the-way-as-adidas-introduces-new-race-and-training-silhouettes-to-its-awar/S/ecd0a1fe-e467-4f81-a767-0a64ab29d98f"
        ],
        "note": "First limited drop in October 2024; wider availability followed in March 2025.",
        "release_year": 2024
      }
    },
    "brand": "Adidas",
    "name": "Adizero EVO SL",
    "year": 2024,
    "descriptive_overview": "A lightweight daily trainer inspired by Adidas' elite race-day super shoes.",
    "gender_target": "Men",
    "retail_price": "₱9,000",
    "colorway": "Black / White",
    "description": "A lightweight daily trainer inspired by Adidas' elite race-day super shoes. Listed in the running collection. Further product background has not been supplied.",
    "category": "Running",
    "details_specifications": "Engineered mesh upper; Lightstrike Pro foam midsole; rubber outsole.",
    "shoe_reference_number": "JH6206",
    "review_stars": 4.7,
    "materials": "Engineered mesh; Lightstrike Pro foam; Rubber",
    "country_of_origin": "Germany",
    "closure_type": "Lace-up",
    "cut": "Low",
    "sole_material": "Continental rubber forefoot and clear-rubber heel patches",
    "cushioning": "Full-length LIGHTSTRIKE PRO foam",
    "weight_g": 224.0,
    "release_month": 10
  },
  {
    "id": 7,
    "image_url": "images/7.jpg",
    "image_note": "",
    "provenance": {
      "shoe_reference_number": {
        "status": "verified",
        "sources": [
          "https://www.nike.com/jp/launch/t/kobe-5-protro-bruce-lee"
        ],
        "note": "Reference number and manufacturing source are for the 2020 Kobe 5 Protro Bruce Lee, not the original 2009 release."
      },
      "review_stars": {
        "status": "mock",
        "sources": [],
        "note": "Realistic demonstration rating; not an aggregate of actual customer reviews."
      },
      "country_of_origin": {
        "status": "provided",
        "sources": [],
        "note": "Country of Origin from the supplied reference; not a verified manufacturing location."
      },
      "checked_on": "2026-10-09",
      "closure_type": {
        "status": "observed",
        "sources": [
          "https://www.nike.com/jp/launch/t/kobe-5-protro-bruce-lee"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "cut": {
        "status": "observed",
        "sources": [
          "https://www.nike.com/jp/launch/t/kobe-5-protro-bruce-lee"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "sole_material": {
        "status": "verified",
        "sources": [
          "https://www.nike.com/jp/launch/t/kobe-5-protro-bruce-lee"
        ],
        "note": "Manufacturer specification for the named model/current reference edition."
      },
      "cushioning": {
        "status": "verified",
        "sources": [
          "https://www.nike.com/jp/launch/t/kobe-5-protro-bruce-lee"
        ],
        "note": "Manufacturer specification for the named model/current reference edition."
      },
      "weight_g": {
        "status": "estimated",
        "sources": [
          "https://www.nike.com/jp/launch/t/kobe-5-protro-bruce-lee"
        ],
        "note": "Approx. per shoe, men's US 9; estimate from structured court upper, rubber outsole and impact cushioning. Actual weight varies by size and edition."
      },
      "release_month": {
        "status": "estimated",
        "sources": [
          "https://www.nike.com/jp/launch/t/kobe-5-protro-bruce-lee"
        ],
        "note": "2020 Bruce Lee Protro reference edition; archive year refers to the original Kobe 5.",
        "release_year": 2020
      }
    },
    "brand": "Nike",
    "name": "Kobe 5",
    "year": 2009,
    "descriptive_overview": "Low-top basketball shoe famous for its extreme lightweight support and low court feel.",
    "gender_target": "Men",
    "retail_price": "₱9,895",
    "colorway": "Purple / Black / Metallic Gold / Light Blue",
    "description": "Low-top basketball shoe famous for its extreme lightweight support and low court feel. Listed in the basketball collection. Further product background has not been supplied.",
    "category": "Basketball",
    "details_specifications": "Synthetic leather and mesh upper; rubber outsole; low-top lace-up construction; Zoom Air and responsive foam cushioning in the Protro reference edition.",
    "shoe_reference_number": "CD4991-700",
    "review_stars": 4.8,
    "materials": "Synthetic leather; Mesh; Rubber",
    "country_of_origin": "United States",
    "closure_type": "Lace-up",
    "cut": "Low",
    "sole_material": "Rubber outsole",
    "cushioning": "Zoom Air forefoot unit with responsive foam (Protro edition)",
    "weight_g": 310.0,
    "release_month": 11
  },
  {
    "id": 8,
    "image_url": "images/8.jpg",
    "image_note": "",
    "provenance": {
      "shoe_reference_number": {
        "status": "verified",
        "sources": [
          "https://www.goat.com/en-gb/sneakers/adizero-f50-elite-fg-advancement-pack-if8818"
        ],
        "note": "Reference number matches the catalog model and colorway; the pictured batch has not been authenticated."
      },
      "review_stars": {
        "status": "mock",
        "sources": [],
        "note": "Realistic demonstration rating; not an aggregate of actual customer reviews."
      },
      "country_of_origin": {
        "status": "provided",
        "sources": [],
        "note": "Country of Origin from the supplied reference; not a verified manufacturing location."
      },
      "checked_on": "2026-10-09",
      "closure_type": {
        "status": "observed",
        "sources": [
          "https://news.adidas.com/f50/adidas-introduces-the-new-f50---engineered-for-game-changing-speed/s/ad8f3dfe-58aa-46f1-aa37-41b2565af091"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "cut": {
        "status": "observed",
        "sources": [
          "https://news.adidas.com/f50/adidas-introduces-the-new-f50---engineered-for-game-changing-speed/s/ad8f3dfe-58aa-46f1-aa37-41b2565af091"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "sole_material": {
        "status": "verified",
        "sources": [
          "https://news.adidas.com/f50/adidas-introduces-the-new-f50---engineered-for-game-changing-speed/s/ad8f3dfe-58aa-46f1-aa37-41b2565af091"
        ],
        "note": "Manufacturer specification for the named model/current reference edition."
      },
      "cushioning": {
        "status": "estimated",
        "sources": [
          "https://news.adidas.com/f50/adidas-introduces-the-new-f50---engineered-for-game-changing-speed/s/ad8f3dfe-58aa-46f1-aa37-41b2565af091"
        ],
        "note": "Construction estimate based on the supplied model and category; exact pictured edition is unverified."
      },
      "weight_g": {
        "status": "estimated",
        "sources": [
          "https://news.adidas.com/f50/adidas-introduces-the-new-f50---engineered-for-game-changing-speed/s/ad8f3dfe-58aa-46f1-aa37-41b2565af091"
        ],
        "note": "Approx. per shoe, men's US 9; estimate from lightweight knit/synthetic upper, studded soleplate and thin footbed. Actual weight varies by size and edition."
      },
      "release_month": {
        "status": "verified",
        "sources": [
          "https://news.adidas.com/f50/adidas-introduces-the-new-f50---engineered-for-game-changing-speed/s/ad8f3dfe-58aa-46f1-aa37-41b2565af091"
        ],
        "note": "June 2024 F50 Advancement Pack launch; pictured colorway may differ.",
        "release_year": 2024
      }
    },
    "brand": "Adidas",
    "name": "F50 Elite FG",
    "year": 2024,
    "descriptive_overview": "High-performance football boot engineered for lightweight speed and acceleration.",
    "gender_target": "Both",
    "retail_price": "₱14,500",
    "colorway": "Coral Pink / Red / Black / Metallic Gold",
    "description": "High-performance football boot engineered for lightweight speed and acceleration. Listed in the football collection. Further product background has not been supplied.",
    "category": "Football",
    "details_specifications": "Fibertouch synthetic upper; Sprintweb texture; Sprintframe 360 firm-ground soleplate; compression-fit tongue with lace-up closure.",
    "shoe_reference_number": "IF8818",
    "review_stars": 4.6,
    "materials": "Fibertouch synthetic; Sprintweb; TPU",
    "country_of_origin": "Germany",
    "closure_type": "Lace-up",
    "cut": "Low",
    "sole_material": "Synthetic Sprintframe 360 firm-ground soleplate",
    "cushioning": "Thin foam sockliner; minimal underfoot padding",
    "weight_g": 200.0,
    "release_month": 6
  },
  {
    "id": 9,
    "image_url": "images/9.jpg",
    "image_note": "",
    "provenance": {
      "shoe_reference_number": {
        "status": "mock",
        "sources": [
          "https://newbalance.newsmarket.com/latest-news/new-balance-reveals-headline-taker-pack/s/1464dfa3-8897-4898-96d2-3caf9f6ae5d1"
        ],
        "note": "Realistic demonstration reference number generated for this archive; not a verified manufacturer-issued reference.",
        "source_scope": "model"
      },
      "review_stars": {
        "status": "mock",
        "sources": [],
        "note": "Realistic demonstration rating; not an aggregate of actual customer reviews."
      },
      "country_of_origin": {
        "status": "provided",
        "sources": [],
        "note": "Country of Origin from the supplied reference; not a verified manufacturing location."
      },
      "checked_on": "2026-10-09",
      "closure_type": {
        "status": "observed",
        "sources": [
          "https://newbalance.newsmarket.com/latest-news/new-balance-reveals-headline-taker-pack/s/1464dfa3-8897-4898-96d2-3caf9f6ae5d1"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "cut": {
        "status": "observed",
        "sources": [
          "https://newbalance.newsmarket.com/latest-news/new-balance-reveals-headline-taker-pack/s/1464dfa3-8897-4898-96d2-3caf9f6ae5d1"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "sole_material": {
        "status": "verified",
        "sources": [
          "https://newbalance.newsmarket.com/latest-news/new-balance-reveals-headline-taker-pack/s/1464dfa3-8897-4898-96d2-3caf9f6ae5d1"
        ],
        "note": "Manufacturer specification for the named model/current reference edition."
      },
      "cushioning": {
        "status": "estimated",
        "sources": [
          "https://newbalance.newsmarket.com/latest-news/new-balance-reveals-headline-taker-pack/s/1464dfa3-8897-4898-96d2-3caf9f6ae5d1"
        ],
        "note": "Construction estimate based on the supplied model and category; exact pictured edition is unverified."
      },
      "weight_g": {
        "status": "estimated",
        "sources": [
          "https://newbalance.newsmarket.com/latest-news/new-balance-reveals-headline-taker-pack/s/1464dfa3-8897-4898-96d2-3caf9f6ae5d1"
        ],
        "note": "Approx. per shoe, men's US 9; estimate from lightweight knit/synthetic upper, studded soleplate and thin footbed. Actual weight varies by size and edition."
      },
      "release_month": {
        "status": "verified",
        "sources": [
          "https://newbalance.newsmarket.com/latest-news/new-balance-reveals-headline-taker-pack/s/1464dfa3-8897-4898-96d2-3caf9f6ae5d1"
        ],
        "note": "October 2022 Headline Taker edition; archive year describes the supplied pair.",
        "release_year": 2022
      }
    },
    "brand": "New Balance",
    "name": "Furon V7 Elite FG",
    "year": 2024,
    "descriptive_overview": "Elite speed boot featuring a minimal Hypoknit upper and responsive outsole.",
    "gender_target": "Both",
    "retail_price": "₱12,500",
    "colorway": "Black / White / Red",
    "description": "Elite speed boot featuring a minimal Hypoknit upper and responsive outsole. Listed in the football collection. Further product background has not been supplied.",
    "category": "Football",
    "details_specifications": "Hypoknit upper; mesh lining; off-set lacing; nylon firm-ground soleplate.",
    "shoe_reference_number": "SF1FDF7",
    "review_stars": 4.4,
    "materials": "Hypoknit; Synthetic lining; Nylon",
    "country_of_origin": "United States",
    "closure_type": "Lace-up",
    "cut": "Low",
    "sole_material": "Nylon firm-ground soleplate",
    "cushioning": "Thin foam sockliner; minimal underfoot padding",
    "weight_g": 180.0,
    "release_month": 10
  },
  {
    "id": 10,
    "image_url": "images/10.jpg",
    "image_note": "",
    "provenance": {
      "shoe_reference_number": {
        "status": "verified",
        "sources": [
          "https://www.nike.com/sg/launch/t/air-jordan-4-white-cement/"
        ],
        "note": "Reference number is for the 2025 White Cement retro; 1989 remains the supplied silhouette year."
      },
      "review_stars": {
        "status": "mock",
        "sources": [],
        "note": "Realistic demonstration rating; not an aggregate of actual customer reviews."
      },
      "country_of_origin": {
        "status": "provided",
        "sources": [],
        "note": "Country of Origin from the supplied reference; not a verified manufacturing location."
      },
      "checked_on": "2026-10-09",
      "closure_type": {
        "status": "observed",
        "sources": [
          "https://www.nike.com/gb/t/buty-air-jordan-4-retro-2pKZfn/HV0823-200"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "cut": {
        "status": "observed",
        "sources": [
          "https://www.nike.com/gb/t/buty-air-jordan-4-retro-2pKZfn/HV0823-200"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "sole_material": {
        "status": "verified",
        "sources": [
          "https://www.nike.com/gb/t/buty-air-jordan-4-retro-2pKZfn/HV0823-200"
        ],
        "note": "Manufacturer specification for the named model/current reference edition."
      },
      "cushioning": {
        "status": "verified",
        "sources": [
          "https://www.nike.com/gb/t/buty-air-jordan-4-retro-2pKZfn/HV0823-200"
        ],
        "note": "Manufacturer specification for the named model/current reference edition."
      },
      "weight_g": {
        "status": "estimated",
        "sources": [
          "https://www.nike.com/gb/t/buty-air-jordan-4-retro-2pKZfn/HV0823-200"
        ],
        "note": "Approx. per shoe, men's US 9; estimate from structured court upper, rubber outsole and impact cushioning. Actual weight varies by size and edition."
      },
      "release_month": {
        "status": "verified",
        "sources": [
          "https://www.goat.com/en-mx/sneakers/air-jordan-4-retro-og-white-cement-2025-fv5029-100"
        ],
        "note": "2025 White Cement reference edition; archive year is the original silhouette year.",
        "release_year": 2025
      }
    },
    "brand": "Jordan",
    "name": "Air Jordan 4",
    "year": 1989,
    "descriptive_overview": "Tinker Hatfield design featuring mesh side panels and iconic support wings.",
    "gender_target": "Men",
    "retail_price": "₱11,500",
    "colorway": "Red / Black / White / Grey",
    "description": "Tinker Hatfield design featuring mesh side panels and iconic support wings. Listed in the basketball collection. Further product background has not been supplied.",
    "category": "Basketball",
    "details_specifications": "Leather and mesh upper; TPU support wings; rubber outsole; lace-up closure.",
    "shoe_reference_number": "FV5029-100",
    "review_stars": 4.8,
    "materials": "Leather; Mesh; Rubber",
    "country_of_origin": "United States",
    "closure_type": "Lace-up",
    "cut": "Mid",
    "sole_material": "Rubber outsole",
    "cushioning": "Nike Air cushioning with foam midsole",
    "weight_g": 480.0,
    "release_month": 5
  },
  {
    "id": 11,
    "image_url": "images/11.jpg",
    "image_note": "",
    "provenance": {
      "shoe_reference_number": {
        "status": "verified",
        "sources": [
          "https://www.nike.com/sg/launch/t/air-jordan-3-black-cement"
        ],
        "note": "Reference number is for the 2024 Black Cement retro; 1988 remains the supplied silhouette year."
      },
      "review_stars": {
        "status": "mock",
        "sources": [],
        "note": "Realistic demonstration rating; not an aggregate of actual customer reviews."
      },
      "country_of_origin": {
        "status": "provided",
        "sources": [],
        "note": "Country of Origin from the supplied reference; not a verified manufacturing location."
      },
      "checked_on": "2026-10-09",
      "closure_type": {
        "status": "observed",
        "sources": [
          "https://www.nike.com/t/air-jordan-3-retro-mens-shoes-1ViayvSi/IF4396-103"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "cut": {
        "status": "observed",
        "sources": [
          "https://www.nike.com/t/air-jordan-3-retro-mens-shoes-1ViayvSi/IF4396-103"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "sole_material": {
        "status": "verified",
        "sources": [
          "https://www.nike.com/t/air-jordan-3-retro-mens-shoes-1ViayvSi/IF4396-103"
        ],
        "note": "Manufacturer specification for the named model/current reference edition."
      },
      "cushioning": {
        "status": "verified",
        "sources": [
          "https://www.nike.com/t/air-jordan-3-retro-mens-shoes-1ViayvSi/IF4396-103"
        ],
        "note": "Manufacturer specification for the named model/current reference edition."
      },
      "weight_g": {
        "status": "estimated",
        "sources": [
          "https://www.nike.com/t/air-jordan-3-retro-mens-shoes-1ViayvSi/IF4396-103"
        ],
        "note": "Approx. per shoe, men's US 9; estimate from structured court upper, rubber outsole and impact cushioning. Actual weight varies by size and edition."
      },
      "release_month": {
        "status": "verified",
        "sources": [
          "https://launches.endclothing.com/product/air-jordan-3-retro-sneaker-dn3707-010"
        ],
        "note": "November 2024 Black Cement reference edition; archive year is the original silhouette year.",
        "release_year": 2024
      }
    },
    "brand": "Jordan",
    "name": "Air Jordan 3",
    "year": 1988,
    "descriptive_overview": "Iconic Tinker Hatfield silhouette that introduced the Jumpman logo and legendary elephant print overlays.",
    "gender_target": "Men",
    "retail_price": "₱12,000",
    "colorway": "White / Navy Blue / Grey / Black / Red",
    "description": "Iconic Tinker Hatfield silhouette that introduced the Jumpman logo and legendary elephant print overlays. Listed in the basketball collection. Further product background has not been supplied.",
    "category": "Basketball",
    "details_specifications": "Leather upper; synthetic overlays with elephant-print detailing; rubber outsole.",
    "shoe_reference_number": "DN3707-010",
    "review_stars": 4.7,
    "materials": "Leather; Synthetic overlays; Rubber",
    "country_of_origin": "United States",
    "closure_type": "Lace-up",
    "cut": "Mid",
    "sole_material": "Rubber outsole",
    "cushioning": "Air-Sole heel and forefoot units with foam midsole",
    "weight_g": 450.0,
    "release_month": 11
  },
  {
    "id": 12,
    "image_url": "images/12.jpg",
    "image_note": "",
    "provenance": {
      "shoe_reference_number": {
        "status": "verified",
        "sources": [
          "https://brand.assets.adidas.com/image/upload/v1727663415/TYC_voucher_cyber_lunes_sept_2024_VF_7d900119d5.pdf"
        ],
        "note": "Reference number matches the catalog model and colorway; the pictured batch has not been authenticated."
      },
      "review_stars": {
        "status": "mock",
        "sources": [],
        "note": "Realistic demonstration rating; not an aggregate of actual customer reviews."
      },
      "country_of_origin": {
        "status": "provided",
        "sources": [],
        "note": "Country of Origin from the supplied reference; not a verified manufacturing location."
      },
      "checked_on": "2026-10-09",
      "closure_type": {
        "status": "observed",
        "sources": [
          "https://news.adidas.com/basketball/adidas-basketball-launches-the-harden-vol-8/s/48f1c5a8-78b4-46af-a589-9135de95b6ed"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "cut": {
        "status": "observed",
        "sources": [
          "https://news.adidas.com/basketball/adidas-basketball-launches-the-harden-vol-8/s/48f1c5a8-78b4-46af-a589-9135de95b6ed"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "sole_material": {
        "status": "verified",
        "sources": [
          "https://news.adidas.com/basketball/adidas-basketball-launches-the-harden-vol-8/s/48f1c5a8-78b4-46af-a589-9135de95b6ed"
        ],
        "note": "Manufacturer specification for the named model/current reference edition."
      },
      "cushioning": {
        "status": "verified",
        "sources": [
          "https://news.adidas.com/basketball/adidas-basketball-launches-the-harden-vol-8/s/48f1c5a8-78b4-46af-a589-9135de95b6ed"
        ],
        "note": "Manufacturer specification for the named model/current reference edition."
      },
      "weight_g": {
        "status": "estimated",
        "sources": [
          "https://news.adidas.com/basketball/adidas-basketball-launches-the-harden-vol-8/s/48f1c5a8-78b4-46af-a589-9135de95b6ed"
        ],
        "note": "Approx. per shoe, men's US 9; estimate from structured court upper, rubber outsole and impact cushioning. Actual weight varies by size and edition."
      },
      "release_month": {
        "status": "verified",
        "sources": [
          "https://news.adidas.com/basketball/adidas-basketball-launches-the-harden-vol-8/s/48f1c5a8-78b4-46af-a589-9135de95b6ed"
        ],
        "note": "Harden Vol. 8 model launch in February 2024.",
        "release_year": 2024
      }
    },
    "brand": "Adidas",
    "name": "Harden Volume 8",
    "year": 2024,
    "descriptive_overview": "James Harden signature basketball shoe with a distinctive EVA cage and Jet Boost midsole.",
    "gender_target": "Men",
    "retail_price": "₱8,900",
    "colorway": "Black / Cream",
    "description": "James Harden signature basketball shoe with a distinctive EVA cage and Jet Boost midsole. Listed in the basketball collection. Further product background has not been supplied.",
    "category": "Basketball",
    "details_specifications": "Textile upper; EVA support cage; Jet Boost midsole; rubber outsole.",
    "shoe_reference_number": "IE2695",
    "review_stars": 4.6,
    "materials": "Textile; EVA; Rubber",
    "country_of_origin": "Germany",
    "closure_type": "Lace-up",
    "cut": "Low",
    "sole_material": "Rubber outsole",
    "cushioning": "Full-length JET BOOST foam",
    "weight_g": 455.0,
    "release_month": 2
  },
  {
    "id": 13,
    "image_url": "images/13.jpg",
    "image_note": "",
    "provenance": {
      "shoe_reference_number": {
        "status": "mock",
        "sources": [
          "https://newbalance.newsmarket.com/hoops/new-balance-athlete-zach-lavine-reveals-new-fresh-foam-bb-v2/s/6e958641-b74c-4e11-b8e4-390ed9e7220f"
        ],
        "note": "Realistic demonstration reference number generated for this archive; not a verified manufacturer-issued reference.",
        "source_scope": "model"
      },
      "review_stars": {
        "status": "mock",
        "sources": [],
        "note": "Realistic demonstration rating; not an aggregate of actual customer reviews."
      },
      "country_of_origin": {
        "status": "provided",
        "sources": [],
        "note": "Country of Origin from the supplied reference; not a verified manufacturing location."
      },
      "checked_on": "2026-10-09",
      "closure_type": {
        "status": "observed",
        "sources": [
          "https://newbalance.newsmarket.com/hoops/new-balance-athlete-zach-lavine-reveals-new-fresh-foam-bb-v2/s/6e958641-b74c-4e11-b8e4-390ed9e7220f"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "cut": {
        "status": "observed",
        "sources": [
          "https://newbalance.newsmarket.com/hoops/new-balance-athlete-zach-lavine-reveals-new-fresh-foam-bb-v2/s/6e958641-b74c-4e11-b8e4-390ed9e7220f"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "sole_material": {
        "status": "verified",
        "sources": [
          "https://newbalance.newsmarket.com/hoops/new-balance-athlete-zach-lavine-reveals-new-fresh-foam-bb-v2/s/6e958641-b74c-4e11-b8e4-390ed9e7220f"
        ],
        "note": "Manufacturer specification for the named model/current reference edition."
      },
      "cushioning": {
        "status": "verified",
        "sources": [
          "https://newbalance.newsmarket.com/hoops/new-balance-athlete-zach-lavine-reveals-new-fresh-foam-bb-v2/s/6e958641-b74c-4e11-b8e4-390ed9e7220f"
        ],
        "note": "Manufacturer specification for the named model/current reference edition."
      },
      "weight_g": {
        "status": "estimated",
        "sources": [
          "https://newbalance.newsmarket.com/hoops/new-balance-athlete-zach-lavine-reveals-new-fresh-foam-bb-v2/s/6e958641-b74c-4e11-b8e4-390ed9e7220f"
        ],
        "note": "Approx. per shoe, men's US 9; estimate from structured court upper, rubber outsole and impact cushioning. Actual weight varies by size and edition."
      },
      "release_month": {
        "status": "verified",
        "sources": [
          "https://newbalance.newsmarket.com/hoops/new-balance-athlete-zach-lavine-reveals-new-fresh-foam-bb-v2/s/6e958641-b74c-4e11-b8e4-390ed9e7220f"
        ],
        "note": "Fresh Foam BB v2 model launch in February 2024; exact pictured colorway date may differ.",
        "release_year": 2024
      }
    },
    "brand": "New Balance",
    "name": "Fresh Foam BB v2",
    "year": 2024,
    "descriptive_overview": "Dual-density Fresh Foam X basketball shoe built for cushioned impact protection.",
    "gender_target": "Both",
    "retail_price": "₱8,250",
    "colorway": "Slate Grey / Silver / White / Burgundy",
    "description": "Dual-density Fresh Foam X basketball shoe built for cushioned impact protection. Listed in the basketball collection. Further product background has not been supplied.",
    "category": "Basketball",
    "details_specifications": "Mesh upper; synthetic overlays; dual-density full-length Fresh Foam cushioning; rubber outsole.",
    "shoe_reference_number": "BBFRSHMD2",
    "review_stars": 4.5,
    "materials": "Mesh; Synthetic overlays; Fresh Foam X; Rubber",
    "country_of_origin": "United States",
    "closure_type": "Lace-up",
    "cut": "Low",
    "sole_material": "Rubber outsole",
    "cushioning": "Dual-density full-length Fresh Foam cushioning",
    "weight_g": 460.0,
    "release_month": 2
  },
  {
    "id": 14,
    "image_url": "images/14.jpg",
    "image_note": "",
    "provenance": {
      "shoe_reference_number": {
        "status": "verified",
        "sources": [
          "https://leisure-center.com/products/az-k111-051-1-black-converse-red-heart-chuck-70-sneakers"
        ],
        "note": "Reference number matches the catalog model and colorway; the pictured batch has not been authenticated."
      },
      "review_stars": {
        "status": "mock",
        "sources": [],
        "note": "Realistic demonstration rating; not an aggregate of actual customer reviews."
      },
      "country_of_origin": {
        "status": "provided",
        "sources": [],
        "note": "Country of Origin from the supplied reference; not a verified manufacturing location."
      },
      "checked_on": "2026-10-09",
      "closure_type": {
        "status": "observed",
        "sources": [
          "https://www.converse.com/it/en/shop/p/converse-x-play-comme-des-garcons-chuck-70-unisex/150206MP.html"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "cut": {
        "status": "observed",
        "sources": [
          "https://www.converse.com/it/en/shop/p/converse-x-play-comme-des-garcons-chuck-70-unisex/150206MP.html"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "sole_material": {
        "status": "verified",
        "sources": [
          "https://www.converse.com/it/en/shop/p/converse-x-play-comme-des-garcons-chuck-70-unisex/150206MP.html"
        ],
        "note": "Manufacturer specification for the named model/current reference edition."
      },
      "cushioning": {
        "status": "verified",
        "sources": [
          "https://www.converse.com/it/en/shop/p/converse-x-play-comme-des-garcons-chuck-70-unisex/150206MP.html"
        ],
        "note": "Manufacturer specification for the named model/current reference edition."
      },
      "weight_g": {
        "status": "estimated",
        "sources": [
          "https://www.converse.com/it/en/shop/p/converse-x-play-comme-des-garcons-chuck-70-unisex/150206MP.html"
        ],
        "note": "Approx. per shoe, men's US 9; estimate from casual upper construction, rubber outsole and footbed. Actual weight varies by size and edition."
      },
      "release_month": {
        "status": "verified",
        "sources": [
          "https://www.goat.com/sneakers/comme-des-garcons-play-x-chuck-taylor-1970-low-top-150206c"
        ],
        "note": "May 2015 release of the 150206C reference edition.",
        "release_year": 2015
      }
    },
    "brand": "Converse",
    "name": "Chuck 70 CDG Play Low",
    "year": 2015,
    "descriptive_overview": "A premium Chuck 70 elevated by the iconic bug-eyed heart logo from COMME des GARÇONS PLAY.",
    "gender_target": "Both",
    "retail_price": "₱8,500",
    "colorway": "Black / Cream / Red",
    "description": "A premium Chuck 70 elevated by the iconic bug-eyed heart logo from COMME des GARÇONS PLAY. Listed in the lifestyle collection. Further product background has not been supplied.",
    "category": "Lifestyle",
    "details_specifications": "Canvas upper; rubber toe cap and outsole; low-top lace-up construction.",
    "shoe_reference_number": "150206C",
    "review_stars": 4.6,
    "materials": "Canvas; Rubber",
    "country_of_origin": "United States",
    "closure_type": "Lace-up",
    "cut": "Low",
    "sole_material": "Vulcanized rubber outsole",
    "cushioning": "OrthoLite cushioned insole",
    "weight_g": 430.0,
    "release_month": 5
  },
  {
    "id": 15,
    "image_url": "images/15.jpg",
    "image_note": "",
    "provenance": {
      "shoe_reference_number": {
        "status": "verified",
        "sources": [
          "https://www.nike.com/jp/en/t/v2k-run-womens-shoes-eNkGettO/FD0736-100"
        ],
        "note": "Reference number matches the catalog model and colorway; the pictured batch has not been authenticated."
      },
      "review_stars": {
        "status": "verified",
        "sources": [
          "https://www.nike.com/jp/en/t/v2k-run-womens-shoes-eNkGettO/FD0736-100"
        ],
        "note": "Nike Japan product-page aggregate: 4.7/5; includes incentivized ratings and may combine colorways."
      },
      "country_of_origin": {
        "status": "provided",
        "sources": [],
        "note": "Country of Origin from the supplied reference; not a verified manufacturing location."
      },
      "checked_on": "2026-10-09",
      "closure_type": {
        "status": "observed",
        "sources": [
          "https://www.nike.com/t/v2k-run-womens-shoes-bVNxzR1U/FD0736-100"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "cut": {
        "status": "observed",
        "sources": [
          "https://www.nike.com/t/v2k-run-womens-shoes-bVNxzR1U/FD0736-100"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "sole_material": {
        "status": "verified",
        "sources": [
          "https://www.nike.com/t/v2k-run-womens-shoes-bVNxzR1U/FD0736-100"
        ],
        "note": "Manufacturer specification for the named model/current reference edition."
      },
      "cushioning": {
        "status": "verified",
        "sources": [
          "https://www.nike.com/t/v2k-run-womens-shoes-bVNxzR1U/FD0736-100"
        ],
        "note": "Manufacturer specification for the named model/current reference edition."
      },
      "weight_g": {
        "status": "estimated",
        "sources": [
          "https://www.nike.com/t/v2k-run-womens-shoes-bVNxzR1U/FD0736-100"
        ],
        "note": "Approx. per shoe, women's US 8; estimate from casual upper construction, rubber outsole and footbed. Actual weight varies by size and edition."
      },
      "release_month": {
        "status": "verified",
        "sources": [
          "https://www.goat.com/sneakers/wmns-runtekk-summit-white-fd0736-100"
        ],
        "note": "June 2023 Summit White reference edition, as listed by GOAT.",
        "release_year": 2023
      }
    },
    "brand": "Nike",
    "name": "V2K Run",
    "year": 2023,
    "descriptive_overview": "Retro Y2K running silhouette combining metallic accents and dual-density foam.",
    "gender_target": "Women",
    "retail_price": "₱6,895",
    "colorway": "Silver / Grey / Cream / Black",
    "description": "Retro Y2K running silhouette combining metallic accents and dual-density foam. Listed in the lifestyle collection. Further product background has not been supplied.",
    "category": "Lifestyle",
    "details_specifications": "Mesh upper; synthetic overlays; dual-density foam midsole; rubber outsole; reflective accents.",
    "shoe_reference_number": "FD0736-100",
    "review_stars": 4.7,
    "materials": "Mesh; Synthetic overlays; Foam; Rubber",
    "country_of_origin": "United States",
    "closure_type": "Lace-up",
    "cut": "Low",
    "sole_material": "Rubber outsole",
    "cushioning": "Dual-density foam midsole",
    "weight_g": 320.0,
    "release_month": 6
  },
  {
    "id": 16,
    "image_url": "images/16.jpg",
    "image_note": "",
    "provenance": {
      "shoe_reference_number": {
        "status": "verified",
        "sources": [
          "https://us.puma.com/us/en/pd/speedcat_og/398846"
        ],
        "note": "Reference number matches the catalog model and colorway; the pictured batch has not been authenticated."
      },
      "review_stars": {
        "status": "verified",
        "sources": [
          "https://us.puma.com/us/en/pd/speedcat_og/398846"
        ],
        "note": "PUMA US product-page aggregate: 4.4/5; may combine reviews across sizes and colorways."
      },
      "country_of_origin": {
        "status": "provided",
        "sources": [],
        "note": "Country of Origin from the supplied reference; not a verified manufacturing location."
      },
      "checked_on": "2026-10-09",
      "closure_type": {
        "status": "observed",
        "sources": [
          "https://us.puma.com/us/en/pd/speedcat_og/398846"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "cut": {
        "status": "observed",
        "sources": [
          "https://us.puma.com/us/en/pd/speedcat_og/398846"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "sole_material": {
        "status": "verified",
        "sources": [
          "https://us.puma.com/us/en/pd/speedcat_og/398846"
        ],
        "note": "Manufacturer specification for the named model/current reference edition."
      },
      "cushioning": {
        "status": "estimated",
        "sources": [
          "https://us.puma.com/us/en/pd/speedcat_og/398846"
        ],
        "note": "Construction estimate based on the supplied model and category; exact pictured edition is unverified."
      },
      "weight_g": {
        "status": "estimated",
        "sources": [
          "https://us.puma.com/us/en/pd/speedcat_og/398846"
        ],
        "note": "Approx. per shoe, men's US 9; estimate from casual upper construction, rubber outsole and footbed. Actual weight varies by size and edition."
      },
      "release_month": {
        "status": "verified",
        "sources": [
          "https://jp.puma.com/jp/ja/press-releases/JP_AW24_xBU_Other_PressReleases_speedcat"
        ],
        "note": "June 2024 Speedcat OG relaunch; archive year is the 1999 silhouette debut.",
        "release_year": 2024
      }
    },
    "brand": "Puma",
    "name": "Speedcat",
    "year": 1999,
    "descriptive_overview": "Motorsport-inspired low-profile classic originally created for Formula 1 drivers.",
    "gender_target": "Both",
    "retail_price": "₱5,500",
    "colorway": "Red / White / Metallic Gold",
    "description": "Motorsport-inspired low-profile classic originally created for Formula 1 drivers. Listed in the lifestyle collection. Further product background has not been supplied.",
    "category": "Lifestyle",
    "details_specifications": "Suede and leather upper; rubber outsole; low-profile lace-up construction.",
    "shoe_reference_number": "398846_01",
    "review_stars": 4.4,
    "materials": "Suede; Leather; Rubber",
    "country_of_origin": "Germany",
    "closure_type": "Lace-up",
    "cut": "Low",
    "sole_material": "Rubber outsole",
    "cushioning": "Low-profile foam footbed",
    "weight_g": 300.0,
    "release_month": 6
  },
  {
    "id": 17,
    "image_url": "images/17.jpg",
    "image_note": "",
    "provenance": {
      "shoe_reference_number": {
        "status": "verified",
        "sources": [
          "https://novelship.com/es-us/onitsuka-tiger-mexico-66-birch-peacoat-1183-c102-200"
        ],
        "note": "Reference number matches the catalog model and colorway; the pictured batch has not been authenticated."
      },
      "review_stars": {
        "status": "mock",
        "sources": [],
        "note": "Realistic demonstration rating; not an aggregate of actual customer reviews."
      },
      "country_of_origin": {
        "status": "provided",
        "sources": [],
        "note": "Country of Origin from the supplied reference; not a verified manufacturing location."
      },
      "checked_on": "2026-10-09",
      "closure_type": {
        "status": "observed",
        "sources": [
          "https://www.onitsukatiger.com/gb/en-gb/mexico-66/p/1183c102-752.html"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "cut": {
        "status": "observed",
        "sources": [
          "https://www.onitsukatiger.com/gb/en-gb/mexico-66/p/1183c102-752.html"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "sole_material": {
        "status": "verified",
        "sources": [
          "https://www.onitsukatiger.com/gb/en-gb/mexico-66/p/1183c102-752.html"
        ],
        "note": "Manufacturer specification for the named model/current reference edition."
      },
      "cushioning": {
        "status": "verified",
        "sources": [
          "https://www.onitsukatiger.com/gb/en-gb/mexico-66/p/1183c102-752.html"
        ],
        "note": "Manufacturer specification for the named model/current reference edition."
      },
      "weight_g": {
        "status": "estimated",
        "sources": [
          "https://www.onitsukatiger.com/gb/en-gb/mexico-66/p/1183c102-752.html"
        ],
        "note": "Approx. per shoe, men's US 9; estimate from casual upper construction, rubber outsole and footbed. Actual weight varies by size and edition."
      },
      "release_month": {
        "status": "estimated",
        "sources": [],
        "note": "Estimated spring catalog window for the current edition; not a confirmed 1966 launch month."
      }
    },
    "brand": "Onitsuka Tiger",
    "name": "Mexico 66",
    "year": 1966,
    "descriptive_overview": "Iconic vintage lifestyle sneaker featuring the signature stripe design.",
    "gender_target": "Both",
    "retail_price": "₱7,000",
    "colorway": "Yellow / Black",
    "description": "Iconic vintage lifestyle sneaker featuring the signature stripe design. Listed in the lifestyle collection. Further product background has not been supplied.",
    "category": "Lifestyle",
    "details_specifications": "Leather upper with suede overlays; rubber outsole; low-profile lace-up construction.",
    "shoe_reference_number": "1183C102-200",
    "review_stars": 4.6,
    "materials": "Leather; Suede; Rubber",
    "country_of_origin": "Japan",
    "closure_type": "Lace-up",
    "cut": "Low",
    "sole_material": "Rubber outsole",
    "cushioning": "OrthoLite cushioned insole (current edition)",
    "weight_g": 260.0,
    "release_month": 4
  },
  {
    "id": 18,
    "image_url": "images/18.jpg",
    "image_note": "",
    "provenance": {
      "shoe_reference_number": {
        "status": "mock",
        "sources": [
          "https://newbalance.newsmarket.com/latest-news/new-balance-reveals-headline-taker-pack/s/1464dfa3-8897-4898-96d2-3caf9f6ae5d1"
        ],
        "note": "Realistic demonstration reference number generated for this archive; not a verified manufacturer-issued reference.",
        "source_scope": "model"
      },
      "review_stars": {
        "status": "mock",
        "sources": [],
        "note": "Realistic demonstration rating; not an aggregate of actual customer reviews."
      },
      "country_of_origin": {
        "status": "provided",
        "sources": [],
        "note": "Country of Origin from the supplied reference; not a verified manufacturing location."
      },
      "checked_on": "2026-10-09",
      "closure_type": {
        "status": "observed",
        "sources": [
          "https://newbalance.newsmarket.com/latest-news/new-balance-reveals-headline-taker-pack/s/1464dfa3-8897-4898-96d2-3caf9f6ae5d1"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "cut": {
        "status": "observed",
        "sources": [
          "https://newbalance.newsmarket.com/latest-news/new-balance-reveals-headline-taker-pack/s/1464dfa3-8897-4898-96d2-3caf9f6ae5d1"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "sole_material": {
        "status": "verified",
        "sources": [
          "https://newbalance.newsmarket.com/latest-news/new-balance-reveals-headline-taker-pack/s/1464dfa3-8897-4898-96d2-3caf9f6ae5d1"
        ],
        "note": "Manufacturer specification for the named model/current reference edition."
      },
      "cushioning": {
        "status": "estimated",
        "sources": [
          "https://newbalance.newsmarket.com/latest-news/new-balance-reveals-headline-taker-pack/s/1464dfa3-8897-4898-96d2-3caf9f6ae5d1"
        ],
        "note": "Construction estimate based on the supplied model and category; exact pictured edition is unverified."
      },
      "weight_g": {
        "status": "estimated",
        "sources": [
          "https://newbalance.newsmarket.com/latest-news/new-balance-reveals-headline-taker-pack/s/1464dfa3-8897-4898-96d2-3caf9f6ae5d1"
        ],
        "note": "Approx. per shoe, men's US 9; estimate from lightweight knit/synthetic upper, studded soleplate and thin footbed. Actual weight varies by size and edition."
      },
      "release_month": {
        "status": "estimated",
        "sources": [],
        "note": "October 2022 Headline Taker edition; archive year describes the supplied pair.",
        "release_year": 2022
      }
    },
    "brand": "New Balance",
    "name": "Tekela V4 Elite FG",
    "year": 2024,
    "descriptive_overview": "Laceless football boot created for playmakers seeking touch and multidirectional traction.",
    "gender_target": "Both",
    "retail_price": "₱12,500",
    "colorway": "Navy Blue / Light Blue / Black / Orange",
    "description": "Laceless football boot created for playmakers seeking touch and multidirectional traction. Listed in the football collection. Further product background has not been supplied.",
    "category": "Football",
    "details_specifications": "Full-foot stretch-knit upper; laceless closure; directional heel lining; nylon firm-ground soleplate with TPU rim studs.",
    "shoe_reference_number": "ST1FGD4",
    "review_stars": 4.5,
    "materials": "Hypoknit; Synthetic lining; Nylon",
    "country_of_origin": "United States",
    "closure_type": "Laceless",
    "cut": "High",
    "sole_material": "Nylon soleplate with TPU rim studs",
    "cushioning": "Thin foam sockliner; minimal underfoot padding",
    "weight_g": 215.0,
    "release_month": 10
  },
  {
    "id": 19,
    "image_url": "images/19.jpg",
    "image_note": "",
    "provenance": {
      "shoe_reference_number": {
        "status": "mock",
        "sources": [
          "https://th.anta.com/en/pages/technology-showcase"
        ],
        "note": "Realistic demonstration reference number generated for this archive; not a verified manufacturer-issued reference.",
        "source_scope": "model"
      },
      "review_stars": {
        "status": "mock",
        "sources": [],
        "note": "Realistic demonstration rating; not an aggregate of actual customer reviews."
      },
      "country_of_origin": {
        "status": "provided",
        "sources": [],
        "note": "Country of Origin from the supplied reference; not a verified manufacturing location."
      },
      "checked_on": "2026-10-09",
      "closure_type": {
        "status": "observed",
        "sources": [
          "https://th.anta.com/en/pages/technology-showcase"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "cut": {
        "status": "observed",
        "sources": [
          "https://th.anta.com/en/pages/technology-showcase"
        ],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "sole_material": {
        "status": "estimated",
        "sources": [
          "https://th.anta.com/en/pages/technology-showcase"
        ],
        "note": "Construction estimate based on the supplied model and category; exact pictured edition is unverified."
      },
      "cushioning": {
        "status": "estimated",
        "sources": [
          "https://th.anta.com/en/pages/technology-showcase"
        ],
        "note": "Construction estimate based on the supplied model and category; exact pictured edition is unverified."
      },
      "weight_g": {
        "status": "estimated",
        "sources": [
          "https://th.anta.com/en/pages/technology-showcase"
        ],
        "note": "Approx. per shoe, men's US 9; estimate from structured court upper, rubber outsole and impact cushioning. Actual weight varies by size and edition."
      },
      "release_month": {
        "status": "estimated",
        "sources": [],
        "note": "Estimated mid-2023 model launch window; exact pictured edition date is unconfirmed.",
        "release_year": 2023
      }
    },
    "brand": "Anta",
    "name": "Shock Wave 5",
    "year": 2023,
    "descriptive_overview": "Durable high-traction outdoor basketball sneaker endorsed by Kyrie Irving.",
    "gender_target": "Men",
    "retail_price": "₱6,500",
    "colorway": "Black / Purple / Cyan Blue / White / Pink",
    "description": "Durable high-traction outdoor basketball sneaker endorsed by Kyrie Irving. Listed in the basketball collection. Further product background has not been supplied.",
    "category": "Basketball",
    "details_specifications": "Mesh upper; TPU support elements; nitrogen foam cushioning; rubber outsole.",
    "shoe_reference_number": "112311101-17",
    "review_stars": 4.7,
    "materials": "Mesh; TPU; Nitrogen foam; Rubber",
    "country_of_origin": "China",
    "closure_type": "Lace-up",
    "cut": "Low",
    "sole_material": "Abrasion-resistant rubber outsole",
    "cushioning": "ANTA nitrogen-infused foam",
    "weight_g": 400.0,
    "release_month": 6
  },
  {
    "id": 20,
    "image_url": "images/20.jpg",
    "image_note": "",
    "provenance": {
      "shoe_reference_number": {
        "status": "mock",
        "sources": [
          "https://anta.com/"
        ],
        "note": "Realistic demonstration reference number generated for this archive; not a verified manufacturer-issued reference.",
        "source_scope": "model"
      },
      "review_stars": {
        "status": "mock",
        "sources": [],
        "note": "Realistic demonstration rating; not an aggregate of actual customer reviews."
      },
      "country_of_origin": {
        "status": "provided",
        "sources": [],
        "note": "Country of Origin from the supplied reference; not a verified manufacturing location."
      },
      "checked_on": "2026-10-09",
      "closure_type": {
        "status": "observed",
        "sources": [],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "cut": {
        "status": "observed",
        "sources": [],
        "note": "Construction identified from the supplied product photograph and model description."
      },
      "sole_material": {
        "status": "estimated",
        "sources": [],
        "note": "Construction estimate based on the supplied model and category; exact pictured edition is unverified."
      },
      "cushioning": {
        "status": "estimated",
        "sources": [],
        "note": "Construction estimate based on the supplied model and category; exact pictured edition is unverified."
      },
      "weight_g": {
        "status": "estimated",
        "sources": [],
        "note": "Approx. per shoe, men's US 9; estimate from structured court upper, rubber outsole and impact cushioning. Actual weight varies by size and edition."
      },
      "release_month": {
        "status": "estimated",
        "sources": [],
        "note": "Estimated autumn 2023 catalog window from the supplied archive year; exact release date is unconfirmed.",
        "release_year": 2023
      }
    },
    "brand": "Anta",
    "name": "Rocket 6",
    "year": 2023,
    "descriptive_overview": "Budget-friendly performance basketball shoe focused on stability and court grip.",
    "gender_target": "Men",
    "retail_price": "₱4,500",
    "colorway": "Orange / Red / Black / White",
    "description": "Budget-friendly performance basketball shoe focused on stability and court grip. Listed in the basketball collection. Further product background has not been supplied.",
    "category": "Basketball",
    "details_specifications": "Mesh upper; synthetic overlays; EVA cushioning; rubber outsole.",
    "shoe_reference_number": "112331606-12",
    "review_stars": 4.3,
    "materials": "Mesh; Synthetic overlays; EVA; Rubber",
    "country_of_origin": "China",
    "closure_type": "Lace-up",
    "cut": "Low",
    "sole_material": "Rubber outsole",
    "cushioning": "EVA foam midsole",
    "weight_g": 375.0,
    "release_month": 9
  }
]$catalog$::jsonb
);
SELECT setval('sole.sneakers_id_seq', (SELECT max(id) FROM sole.sneakers));
