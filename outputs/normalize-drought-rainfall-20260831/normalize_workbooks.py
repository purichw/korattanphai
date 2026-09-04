import json
import re
from pathlib import Path

import pandas as pd


ROOT = Path("/Users/point/Kaset-Tan-Phai")
OUT = ROOT / "outputs" / "normalize-drought-rainfall-20260831"
DROUGHT_XLSX = Path("/Users/point/Downloads/Drought.xlsx")
RAINFALL_XLSX = Path("/Users/point/Downloads/Rainfall.xlsx")
ADMIN_JSON = ROOT / "src/data/canonical/nakhon_ratchasima/admin_hierarchy.json"
GEODATA_JSON = ROOT / "public/geodata/nakhon-ratchasima-subdistricts.geojson"

PROVINCE_ID = "TH-P29"
PROVINCE_CODE = "30"
PROVINCE_TH = "นครราชสีมา"
PROVINCE_EN = "Nakhon Ratchasima"

KEY_COLS = ["Year", "Month", "ID", "TAMBON_E", "AMPHOE_E", "Irrigation_Status"]

DISTRICT_ALIASES = {
    "CHALOEMPHRAKIET": "CHALEOMPHRAKIAT",
    "KHAMSAKAESAENG": "KHAMSAKAESAENG",
    "LAMTAMANCHAI": "LAMTHAMENCHAI",
    "SIKHIO": "SIKHIO",
}

GEODATA_SUBDISTRICT_EN_OVERRIDES = {
    "300101": "TAMBON NAI MUEANG",
    "300113": "TAMBON BAN MAI",
    "301811": "TAMBON KUT CHIK",
    "302401": "TAMBON NON DAENG",
    "302405": "TAMBON DON YAO YAI",
}


def compact_name(value: object) -> str:
    text = str(value).upper().strip()
    text = re.sub(r"^(AMPHOE|TAMBON|CHANGWAT)\s+", "", text)
    text = re.sub(r"[^A-Z0-9]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip().replace(" ", "")
    return DISTRICT_ALIASES.get(text, text)


def normalize_irrigation_status(value: str) -> tuple[str, str]:
    raw = str(value).strip()
    if raw == "Irragation":
        return "Irrigation", "IRRIGATION_STATUS_NORMALIZED"
    return raw, ""


def risk_label_th(level: int | float) -> str:
    return {
        0: "ปกติ",
        1: "เฝ้าระวัง",
        2: "รุนแรง",
    }.get(int(level), "ไม่ทราบระดับ")


def quality_flags(*flags: str) -> str:
    return ";".join(flag for flag in flags if flag)


def read_source(path: Path, value_col: str, source_file_label: str) -> pd.DataFrame:
    df = pd.read_excel(path, engine="openpyxl")
    df.columns = [str(col).strip() for col in df.columns]
    df.insert(0, "source_row_number", range(2, len(df) + 2))
    df.insert(1, "source_workbook", source_file_label)
    df.insert(2, "source_sheet", df.attrs.get("sheet_name", ""))
    for col in ["TAMBON_E", "AMPHOE_E", "Irrigation_Status"]:
        df[col] = df[col].astype(str).str.strip()
    for col in ["Year", "Month", "ID"]:
        df[col] = pd.to_numeric(df[col], errors="raise").astype(int)
    df[value_col] = pd.to_numeric(df[value_col], errors="raise")
    return df


def load_canonical_geography() -> tuple[pd.DataFrame, pd.DataFrame]:
    admin = json.loads(ADMIN_JSON.read_text())
    district_lookup = {}
    canonical_rows = []
    for district in admin["province"]["districts"]:
        district_lookup[district["districtCode"]] = {
            "districtCode": district["districtCode"],
            "districtNameTh": district["nameTh"],
            "districtNameEn": district["name"],
            "districtId": district["id"],
            "districtSlug": district["routingSlug"],
        }
        for subdistrict in district["subdistricts"]:
            canonical_rows.append(
                {
                    "provinceId": PROVINCE_ID,
                    "provinceCode": PROVINCE_CODE,
                    "provinceNameTh": PROVINCE_TH,
                    "provinceNameEn": PROVINCE_EN,
                    "districtCode": district["districtCode"],
                    "districtId": district["id"],
                    "districtNameTh": district["nameTh"],
                    "districtNameEn": district["name"],
                    "districtSlug": district["routingSlug"],
                    "subdistrictCode": subdistrict["subdistrictCode"],
                    "subdistrictId": subdistrict["id"],
                    "subdistrictNameTh": subdistrict["nameTh"],
                    "subdistrictSlug": subdistrict["routingSlug"],
                }
            )

    geo = json.loads(GEODATA_JSON.read_text())
    geodata_rows = []
    for feature in geo["features"]:
        props = feature["properties"]
        admin_code = str(props["Admin_code"])
        district_code = f"{props['P_code']}{props['A_code']}"
        geodata_rows.append(
            {
                "subdistrictCode": admin_code,
                "districtCode": district_code,
                "geodataDistrictNameTh": str(props["A_Name_T"]).replace("อำเภอ", "", 1),
                "geodataSubdistrictNameTh": str(props["T_Name_T"]).replace("ตำบล", "", 1),
                "geodataDistrictNameEn": props["A_Name_E"],
                "geodataSubdistrictNameEnOriginal": props["T_Name_E"],
                "geodataSubdistrictNameEnForMatch": GEODATA_SUBDISTRICT_EN_OVERRIDES.get(
                    admin_code, props["T_Name_E"]
                ),
                "geodataLabelOverrideApplied": admin_code
                in GEODATA_SUBDISTRICT_EN_OVERRIDES,
            }
        )

    canonical_df = pd.DataFrame(canonical_rows)
    geodata_df = pd.DataFrame(geodata_rows)
    return canonical_df, geodata_df.merge(
        canonical_df,
        on=["districtCode", "subdistrictCode"],
        how="inner",
        validate="one_to_one",
    )


def build_area_crosswalk(area_df: pd.DataFrame, geodata_df: pd.DataFrame) -> pd.DataFrame:
    area_df = area_df.copy()
    area_df["sourceAmphoeEnCorrected"] = area_df["AMPHOE_E"]
    source_correction_mask = (area_df["ID"] == 222) & (
        area_df["TAMBON_E"] == "Nong Rawiang"
    )
    area_df.loc[source_correction_mask, "sourceAmphoeEnCorrected"] = "Phimai"
    area_df["sourceAdminCorrectionApplied"] = source_correction_mask

    status = area_df["Irrigation_Status"].apply(normalize_irrigation_status)
    area_df["irrigationStatus"] = status.apply(lambda pair: pair[0])
    area_df["irrigationStatusQualityFlag"] = status.apply(lambda pair: pair[1])

    area_df["joinKey"] = (
        area_df["sourceAmphoeEnCorrected"].apply(compact_name)
        + "|"
        + area_df["TAMBON_E"].apply(compact_name)
    )

    geodata_df = geodata_df.copy()
    geodata_df["joinKey"] = (
        geodata_df["geodataDistrictNameEn"].apply(compact_name)
        + "|"
        + geodata_df["geodataSubdistrictNameEnForMatch"].apply(compact_name)
    )

    merged = area_df.merge(
        geodata_df,
        on="joinKey",
        how="left",
        validate="one_to_one",
        indicator=True,
    )
    unmatched = merged[merged["_merge"] != "both"]
    if len(unmatched):
        raise RuntimeError(
            "Unmatched workbook areas remain after normalization: "
            + unmatched[["ID", "AMPHOE_E", "TAMBON_E"]].to_json(
                orient="records", force_ascii=False
            )
        )

    duplicate_assignments = (
        merged.groupby("subdistrictCode").size().reset_index(name="n").query("n > 1")
    )
    if len(duplicate_assignments):
        raise RuntimeError(
            "Duplicate canonical subdistrict assignments: "
            + duplicate_assignments.to_json(orient="records")
        )

    def match_method(row: pd.Series) -> str:
        methods = []
        if row["sourceAdminCorrectionApplied"]:
            methods.append("SOURCE_ADMIN_CORRECTION")
        if row["geodataLabelOverrideApplied"]:
            methods.append("GEODATA_EN_LABEL_OVERRIDE")
        source_district = compact_name(row["AMPHOE_E"])
        corrected_district = compact_name(row["sourceAmphoeEnCorrected"])
        geodata_district = compact_name(row["geodataDistrictNameEn"])
        source_tambon = compact_name(row["TAMBON_E"])
        geodata_tambon = compact_name(row["geodataSubdistrictNameEnOriginal"])
        if source_district == geodata_district and source_tambon == geodata_tambon:
            methods.append("EXACT_NORMALIZED_EN")
        else:
            methods.append("ALIAS_NORMALIZED_EN")
        if row["irrigationStatusQualityFlag"]:
            methods.append(row["irrigationStatusQualityFlag"])
        return ";".join(dict.fromkeys(methods))

    merged["matchMethod"] = merged.apply(match_method, axis=1)
    merged["qualityFlags"] = merged.apply(
        lambda row: quality_flags(
            "SOURCE_AMPHOE_CORRECTED" if row["sourceAdminCorrectionApplied"] else "",
            "GEODATA_LABEL_OVERRIDE" if row["geodataLabelOverrideApplied"] else "",
            row["irrigationStatusQualityFlag"],
        ),
        axis=1,
    )
    merged["matchStatus"] = "MATCHED"
    merged["researchAreaId"] = merged["ID"].apply(lambda x: f"NR-RESEARCH-AREA-{int(x):03d}")
    merged["sourceAreaKey"] = (
        merged["AMPHOE_E"] + " / " + merged["TAMBON_E"] + " / ID " + merged["ID"].astype(str)
    )

    columns = [
        "researchAreaId",
        "ID",
        "sourceAreaKey",
        "TAMBON_E",
        "AMPHOE_E",
        "sourceAmphoeEnCorrected",
        "Irrigation_Status",
        "irrigationStatus",
        "provinceId",
        "provinceCode",
        "provinceNameTh",
        "provinceNameEn",
        "districtCode",
        "districtId",
        "districtNameTh",
        "districtNameEn",
        "districtSlug",
        "subdistrictCode",
        "subdistrictId",
        "subdistrictNameTh",
        "subdistrictSlug",
        "geodataDistrictNameEn",
        "geodataSubdistrictNameEnOriginal",
        "geodataSubdistrictNameEnForMatch",
        "geodataLabelOverrideApplied",
        "matchStatus",
        "matchMethod",
        "qualityFlags",
    ]
    return merged[columns].sort_values(["districtCode", "subdistrictCode"])


def source_rows_join(values: pd.Series) -> str:
    return ";".join(str(int(v)) for v in sorted(values.tolist()))


def unique_values_join(values: pd.Series) -> str:
    return ";".join(str(int(v)) if float(v).is_integer() else str(v) for v in sorted(values.unique()))


def build_panel(
    rainfall_df: pd.DataFrame, drought_df: pd.DataFrame, crosswalk: pd.DataFrame
) -> tuple[pd.DataFrame, pd.DataFrame]:
    rainfall_group = (
        rainfall_df.groupby(KEY_COLS, dropna=False)
        .agg(
            rainfallMm=("Best_Station_Rainfall", "first"),
            rainfallValueUniqueCount=("Best_Station_Rainfall", "nunique"),
            rainfallRawRowCount=("source_row_number", "count"),
            rainfallSourceRows=("source_row_number", source_rows_join),
        )
        .reset_index()
    )

    drought_group = (
        drought_df.groupby(KEY_COLS, dropna=False)
        .agg(
            droughtRiskFirst=("Drought_Risk", "first"),
            droughtRiskLast=("Drought_Risk", "last"),
            droughtRiskMin=("Drought_Risk", "min"),
            droughtRiskMax=("Drought_Risk", "max"),
            droughtRiskUniqueCount=("Drought_Risk", "nunique"),
            droughtRiskValuesRaw=("Drought_Risk", unique_values_join),
            droughtRawRowCount=("source_row_number", "count"),
            droughtSourceRows=("source_row_number", source_rows_join),
        )
        .reset_index()
    )
    drought_group["droughtRiskConflict"] = drought_group["droughtRiskUniqueCount"] > 1
    drought_group["droughtRiskLevel"] = drought_group["droughtRiskMax"].astype(int)
    drought_group["droughtRiskLabelTh"] = drought_group["droughtRiskLevel"].apply(risk_label_th)
    drought_group["droughtRiskResolutionPolicy"] = drought_group["droughtRiskConflict"].map(
        {True: "CONSERVATIVE_MAX_WITH_CONFLICT_FLAG", False: "AS_REPORTED"}
    )

    panel = rainfall_group.merge(drought_group, on=KEY_COLS, how="inner", validate="one_to_one")
    crosswalk_for_panel = crosswalk.rename(
        columns={
            "ID": "sourceResearchId",
            "TAMBON_E": "sourceTambonEn",
            "AMPHOE_E": "sourceAmphoeEn",
            "Irrigation_Status": "irrigationStatusSource",
        }
    )
    panel = panel.merge(
        crosswalk_for_panel,
        left_on=["ID", "TAMBON_E", "AMPHOE_E", "Irrigation_Status"],
        right_on=[
            "sourceResearchId",
            "sourceTambonEn",
            "sourceAmphoeEn",
            "irrigationStatusSource",
        ],
        how="left",
        validate="many_to_one",
    )
    if panel["subdistrictCode"].isna().any():
        raise RuntimeError("Panel rows with missing crosswalk mappings")

    panel["period"] = panel.apply(lambda row: f"{int(row['Year']):04d}-{int(row['Month']):02d}", axis=1)
    panel["periodStartDate"] = panel["period"] + "-01"
    panel["recordId"] = (
        "NR-MONTHLY-"
        + panel["period"]
        + "-"
        + panel["subdistrictCode"].astype(str)
    )
    panel["rainfallUnit"] = "mm"
    panel["rainfallTemporalGranularity"] = "monthly"
    panel["rainfallSourceField"] = "Best_Station_Rainfall"
    panel["rainfallProvenanceClass"] = "DERIVED"
    panel["droughtSourceField"] = "Drought_Risk"
    panel["droughtProvenanceClass"] = "DERIVED"
    panel["sourceBundle"] = "Drought.xlsx + Rainfall.xlsx"
    panel["websiteImportStatus"] = panel["droughtRiskConflict"].map(
        {True: "READY_WITH_CONFLICT_FLAG", False: "READY"}
    )
    panel["qualityFlags"] = panel.apply(
        lambda row: quality_flags(
            row.get("qualityFlags", ""),
            "RAINFALL_SOURCE_DUPLICATE" if row["rainfallRawRowCount"] > 1 else "",
            "DROUGHT_SOURCE_DUPLICATE" if row["droughtRawRowCount"] > 1 else "",
            "DROUGHT_RISK_CONFLICT" if row["droughtRiskConflict"] else "",
        ),
        axis=1,
    )
    panel["notes"] = panel["droughtRiskConflict"].map(
        {
            True: "Drought risk duplicated with conflicting class values; droughtRiskLevel uses conservative maximum and raw values are retained.",
            False: "",
        }
    )

    columns = [
        "recordId",
        "period",
        "periodStartDate",
        "Year",
        "Month",
        "provinceId",
        "provinceCode",
        "provinceNameTh",
        "provinceNameEn",
        "districtCode",
        "districtId",
        "districtNameTh",
        "districtNameEn",
        "districtSlug",
        "subdistrictCode",
        "subdistrictId",
        "subdistrictNameTh",
        "subdistrictSlug",
        "researchAreaId",
        "sourceResearchId",
        "sourceTambonEn",
        "sourceAmphoeEn",
        "sourceAmphoeEnCorrected",
        "irrigationStatusSource",
        "irrigationStatus",
        "rainfallMm",
        "rainfallUnit",
        "rainfallTemporalGranularity",
        "rainfallSourceField",
        "rainfallProvenanceClass",
        "rainfallRawRowCount",
        "rainfallValueUniqueCount",
        "rainfallSourceRows",
        "droughtRiskLevel",
        "droughtRiskLabelTh",
        "droughtRiskMin",
        "droughtRiskMax",
        "droughtRiskFirst",
        "droughtRiskLast",
        "droughtRiskValuesRaw",
        "droughtRiskUniqueCount",
        "droughtRiskConflict",
        "droughtRiskResolutionPolicy",
        "droughtSourceField",
        "droughtProvenanceClass",
        "droughtRawRowCount",
        "droughtSourceRows",
        "websiteImportStatus",
        "qualityFlags",
        "notes",
    ]
    panel = panel[columns].sort_values(["period", "districtCode", "subdistrictCode"])

    conflicts = panel[panel["droughtRiskConflict"]].copy()
    conflicts = conflicts[
        [
            "recordId",
            "period",
            "districtCode",
            "districtNameTh",
            "subdistrictCode",
            "subdistrictNameTh",
            "researchAreaId",
            "sourceResearchId",
            "sourceAmphoeEn",
            "sourceTambonEn",
            "droughtRiskValuesRaw",
            "droughtRiskMin",
            "droughtRiskMax",
            "droughtRiskLevel",
            "droughtRiskResolutionPolicy",
            "droughtSourceRows",
            "notes",
        ]
    ].sort_values(["period", "districtCode", "subdistrictCode"])
    return panel, conflicts


def build_quality_summary(
    rainfall_df: pd.DataFrame,
    drought_df: pd.DataFrame,
    panel: pd.DataFrame,
    crosswalk: pd.DataFrame,
) -> pd.DataFrame:
    rainfall_duplicates_removed = len(rainfall_df) - len(panel)
    drought_duplicate_rows = len(drought_df) - len(panel)
    rows = [
        ["canonical_area_crosswalk", "matched_areas", len(crosswalk), "All workbook areas map to canonical province/district/subdistrict codes."],
        ["canonical_area_crosswalk", "unmatched_areas", 0, "Import should fail if this becomes non-zero."],
        [
            "canonical_area_crosswalk",
            "source_admin_corrections",
            int(crosswalk["qualityFlags"].str.contains("SOURCE_AMPHOE_CORRECTED", na=False).sum()),
            "ID 222 / Nong Rawiang corrected from Mueang Nakhon Ratchasima to Phimai before joining.",
        ],
        [
            "canonical_area_crosswalk",
            "geodata_label_overrides",
            int(crosswalk["qualityFlags"].str.contains("GEODATA_LABEL_OVERRIDE", na=False).sum()),
            "English labels overridden only where geodata Thai/admin-code evidence supports it.",
        ],
        [
            "canonical_area_crosswalk",
            "irrigation_status_normalized",
            int(crosswalk["qualityFlags"].str.contains("IRRIGATION_STATUS_NORMALIZED", na=False).sum()),
            "Source value Irragation normalized to Irrigation.",
        ],
        [
            "rainfall",
            "source_rows",
            len(rainfall_df),
            "Raw rows retained in Raw_Rainfall.",
        ],
        [
            "rainfall",
            "normalized_panel_rows",
            len(panel),
            "One record per month per canonical subdistrict after identical duplicate removal.",
        ],
        [
            "rainfall",
            "duplicate_source_rows_removed",
            rainfall_duplicates_removed,
            "Rainfall duplicates are identical by key/value and source rows remain traceable.",
        ],
        [
            "rainfall",
            "period_range",
            f"{panel['period'].min()} to {panel['period'].max()}",
            "Monthly historical series.",
        ],
        [
            "drought",
            "source_rows",
            len(drought_df),
            "Raw rows retained in Raw_Drought.",
        ],
        [
            "drought",
            "normalized_panel_rows",
            len(panel),
            "One record per month per canonical subdistrict.",
        ],
        [
            "drought",
            "duplicate_source_rows_grouped",
            drought_duplicate_rows,
            "Duplicate source rows are grouped; conflicts remain explicitly flagged.",
        ],
        [
            "drought",
            "conflicting_monthly_area_records",
            int(panel["droughtRiskConflict"].sum()),
            "droughtRiskLevel uses conservative maximum for import while retaining raw values.",
        ],
    ]
    return pd.DataFrame(rows, columns=["domain", "metric", "value", "note"])


def build_attention_flags(panel: pd.DataFrame, crosswalk: pd.DataFrame) -> pd.DataFrame:
    rows = []
    conflict_panel = panel[panel["droughtRiskConflict"]].copy()
    for _, row in conflict_panel.iterrows():
        rows.append(
            {
                "flagId": f"ATTN-DROUGHT-CONFLICT-{row['period']}-{row['subdistrictCode']}",
                "severity": "REVIEW",
                "flagType": "DROUGHT_RISK_CONFLICT",
                "scope": "monthly_subdistrict",
                "period": row["period"],
                "provinceId": row["provinceId"],
                "districtCode": row["districtCode"],
                "districtNameTh": row["districtNameTh"],
                "subdistrictCode": row["subdistrictCode"],
                "subdistrictNameTh": row["subdistrictNameTh"],
                "researchAreaId": row["researchAreaId"],
                "sourceResearchId": row["sourceResearchId"],
                "sourceArea": f"{row['sourceAmphoeEn']} / {row['sourceTambonEn']}",
                "sourceRows": row["droughtSourceRows"],
                "sourceValues": row["droughtRiskValuesRaw"],
                "normalizedAction": "droughtRiskLevel uses conservative maximum; raw values retained.",
                "affectsNormalizedMainData": "flagged_not_blocking",
                "resolutionRequiredBeforeWebsiteImport": "no",
                "recommendedFollowUp": "Confirm source export logic later; do not block historical demo import.",
            }
        )

    corrected = crosswalk[crosswalk["qualityFlags"].str.contains("SOURCE_AMPHOE_CORRECTED", na=False)]
    for _, row in corrected.iterrows():
        rows.append(
            {
                "flagId": f"ATTN-SOURCE-ADMIN-CORRECTION-{row['researchAreaId']}",
                "severity": "HIGH",
                "flagType": "SOURCE_ADMIN_CORRECTION",
                "scope": "area_crosswalk",
                "period": "",
                "provinceId": row["provinceId"],
                "districtCode": row["districtCode"],
                "districtNameTh": row["districtNameTh"],
                "subdistrictCode": row["subdistrictCode"],
                "subdistrictNameTh": row["subdistrictNameTh"],
                "researchAreaId": row["researchAreaId"],
                "sourceResearchId": row["ID"],
                "sourceArea": f"{row['AMPHOE_E']} / {row['TAMBON_E']}",
                "sourceRows": "",
                "sourceValues": row["AMPHOE_E"],
                "normalizedAction": f"sourceAmphoeEnCorrected={row['sourceAmphoeEnCorrected']}",
                "affectsNormalizedMainData": "auto_corrected_before_join",
                "resolutionRequiredBeforeWebsiteImport": "no",
                "recommendedFollowUp": "Keep as explicit source anomaly; do not join workbook ID directly.",
            }
        )

    geodata_overrides = crosswalk[crosswalk["qualityFlags"].str.contains("GEODATA_LABEL_OVERRIDE", na=False)]
    for _, row in geodata_overrides.iterrows():
        rows.append(
            {
                "flagId": f"ATTN-GEODATA-LABEL-OVERRIDE-{row['subdistrictCode']}",
                "severity": "INFO",
                "flagType": "GEODATA_EN_LABEL_OVERRIDE",
                "scope": "area_crosswalk",
                "period": "",
                "provinceId": row["provinceId"],
                "districtCode": row["districtCode"],
                "districtNameTh": row["districtNameTh"],
                "subdistrictCode": row["subdistrictCode"],
                "subdistrictNameTh": row["subdistrictNameTh"],
                "researchAreaId": row["researchAreaId"],
                "sourceResearchId": row["ID"],
                "sourceArea": f"{row['AMPHOE_E']} / {row['TAMBON_E']}",
                "sourceRows": "",
                "sourceValues": row["geodataSubdistrictNameEnOriginal"],
                "normalizedAction": f"matched with {row['geodataSubdistrictNameEnForMatch']} based on Thai/admin code.",
                "affectsNormalizedMainData": "auto_corrected_before_join",
                "resolutionRequiredBeforeWebsiteImport": "no",
                "recommendedFollowUp": "Prefer canonical admin_hierarchy display names over geodata English labels.",
            }
        )

    irrigation_fixed = crosswalk[crosswalk["qualityFlags"].str.contains("IRRIGATION_STATUS_NORMALIZED", na=False)]
    for _, row in irrigation_fixed.iterrows():
        rows.append(
            {
                "flagId": f"ATTN-IRRIGATION-STATUS-{row['researchAreaId']}",
                "severity": "INFO",
                "flagType": "IRRIGATION_STATUS_NORMALIZED",
                "scope": "area_crosswalk",
                "period": "",
                "provinceId": row["provinceId"],
                "districtCode": row["districtCode"],
                "districtNameTh": row["districtNameTh"],
                "subdistrictCode": row["subdistrictCode"],
                "subdistrictNameTh": row["subdistrictNameTh"],
                "researchAreaId": row["researchAreaId"],
                "sourceResearchId": row["ID"],
                "sourceArea": f"{row['AMPHOE_E']} / {row['TAMBON_E']}",
                "sourceRows": "",
                "sourceValues": row["Irrigation_Status"],
                "normalizedAction": f"irrigationStatus={row['irrigationStatus']}",
                "affectsNormalizedMainData": "auto_normalized",
                "resolutionRequiredBeforeWebsiteImport": "no",
                "recommendedFollowUp": "Keep source spelling in raw sheets only.",
            }
        )

    return pd.DataFrame(rows).sort_values(["severity", "flagType", "period", "districtCode", "subdistrictCode"])


def build_duplicate_audit(rainfall_df: pd.DataFrame, drought_df: pd.DataFrame) -> pd.DataFrame:
    rows = []

    rainfall_group = (
        rainfall_df.groupby(KEY_COLS, dropna=False)
        .agg(
            rawRowCount=("source_row_number", "count"),
            valueUniqueCount=("Best_Station_Rainfall", "nunique"),
            valuesRaw=("Best_Station_Rainfall", lambda values: ";".join(f"{float(v):.7g}" for v in sorted(values.unique()))),
            sourceRows=("source_row_number", source_rows_join),
        )
        .reset_index()
    )
    rainfall_dupes = rainfall_group[rainfall_group["rawRowCount"] > 1]
    for _, row in rainfall_dupes.iterrows():
        rows.append(
            {
                "domain": "rainfall",
                "period": f"{int(row['Year']):04d}-{int(row['Month']):02d}",
                "sourceResearchId": row["ID"],
                "sourceArea": f"{row['AMPHOE_E']} / {row['TAMBON_E']}",
                "sourceField": "Best_Station_Rainfall",
                "rawRowCount": row["rawRowCount"],
                "valueUniqueCount": row["valueUniqueCount"],
                "valuesRaw": row["valuesRaw"],
                "sourceRows": row["sourceRows"],
                "auditStatus": "EXACT_DUPLICATE" if row["valueUniqueCount"] == 1 else "VALUE_CONFLICT",
                "normalizedTreatment": "drop identical duplicate; retain sourceRows in Monthly_Panel",
            }
        )

    drought_group = (
        drought_df.groupby(KEY_COLS, dropna=False)
        .agg(
            rawRowCount=("source_row_number", "count"),
            valueUniqueCount=("Drought_Risk", "nunique"),
            valuesRaw=("Drought_Risk", unique_values_join),
            sourceRows=("source_row_number", source_rows_join),
        )
        .reset_index()
    )
    drought_dupes = drought_group[drought_group["rawRowCount"] > 1]
    for _, row in drought_dupes.iterrows():
        conflict = row["valueUniqueCount"] > 1
        rows.append(
            {
                "domain": "drought",
                "period": f"{int(row['Year']):04d}-{int(row['Month']):02d}",
                "sourceResearchId": row["ID"],
                "sourceArea": f"{row['AMPHOE_E']} / {row['TAMBON_E']}",
                "sourceField": "Drought_Risk",
                "rawRowCount": row["rawRowCount"],
                "valueUniqueCount": row["valueUniqueCount"],
                "valuesRaw": row["valuesRaw"],
                "sourceRows": row["sourceRows"],
                "auditStatus": "VALUE_CONFLICT" if conflict else "EXACT_DUPLICATE",
                "normalizedTreatment": "use conservative maximum with conflict flag"
                if conflict
                else "collapse duplicate; retain sourceRows in Monthly_Panel",
            }
        )
    return pd.DataFrame(rows).sort_values(["domain", "auditStatus", "period", "sourceResearchId"])


def build_resolution_rules() -> pd.DataFrame:
    rows = [
        [
            "R001",
            "geography",
            "Never join website data on Thai name, English name, URL slug, or workbook ID.",
            "Join only after Area_Crosswalk has assigned provinceCode/districtCode/subdistrictCode.",
            "applied",
        ],
        [
            "R002",
            "area_crosswalk",
            "Workbook ID is a source research identifier, not an official administrative code.",
            "Store as sourceResearchId and use canonical subdistrictCode for website joins.",
            "applied",
        ],
        [
            "R003",
            "area_crosswalk",
            "Source row ID 222 labels Nong Rawiang under Mueang Nakhon Ratchasima, creating one extra area there and one missing Phimai area.",
            "Correct sourceAmphoeEnCorrected to Phimai and map to subdistrictCode 301512.",
            "applied_with_attention_flag",
        ],
        [
            "R004",
            "area_crosswalk",
            "Geodata English labels can be inconsistent with Thai/admin-code evidence.",
            "Override only specific English labels where Thai name and admin code prove the intended area.",
            "applied_with_attention_flag",
        ],
        [
            "R005",
            "irrigation",
            "Source value Irragation is a spelling typo.",
            "Normalize to Irrigation; retain original Irragation in raw sheets and source field.",
            "applied_with_attention_flag",
        ],
        [
            "R006",
            "rainfall",
            "Rainfall duplicate keys have identical Best_Station_Rainfall values in this export.",
            "Keep one normalized monthly record; retain source row numbers and duplicate counts.",
            "applied",
        ],
        [
            "R007",
            "drought",
            "Drought duplicate keys sometimes disagree on Drought_Risk class.",
            "Keep one normalized monthly record using conservative maximum; set droughtRiskConflict=true and retain all raw class values/source rows.",
            "applied_with_attention_flag",
        ],
        [
            "R008",
            "provenance",
            "This workbook is research/historical evidence, not live operational truth.",
            "Use DERIVED for rainfall/risk values until source/station lineage is confirmed per record.",
            "applied",
        ],
        [
            "R009",
            "precedence",
            "Approved operational source data prevails if it conflicts with this normalized workbook.",
            "Treat this workbook as historical/model context when approved live data is present.",
            "applied",
        ],
    ]
    return pd.DataFrame(rows, columns=["ruleId", "domain", "sourceCondition", "normalizedAction", "status"])


def build_data_contract() -> pd.DataFrame:
    rows = [
        ["recordId", "string", "Stable derived ID for one monthly canonical subdistrict record.", "Monthly_Panel"],
        ["period", "YYYY-MM", "Monthly observation/model period.", "Monthly_Panel"],
        ["provinceId", "string", "Existing canonical province ID; remains TH-P29.", "Monthly_Panel"],
        ["provinceCode", "string", "DOPA/TIS province code.", "Monthly_Panel"],
        ["districtCode", "string", "Canonical district code used for joins.", "Monthly_Panel"],
        ["subdistrictCode", "string", "Canonical subdistrict code used for joins.", "Monthly_Panel"],
        ["researchAreaId", "string", "Stable wrapper around workbook ID; not an official admin code.", "Area_Crosswalk"],
        ["sourceResearchId", "integer", "Original workbook ID retained for audit only.", "Monthly_Panel"],
        ["irrigationStatus", "enum", "Collecting, RainFed, or Irrigation after typo normalization.", "Monthly_Panel"],
        ["rainfallMm", "number", "Monthly Best_Station_Rainfall from source workbook, unit mm.", "Monthly_Panel"],
        ["rainfallProvenanceClass", "enum", "DERIVED until station/source lineage is confirmed per record.", "Monthly_Panel"],
        ["droughtRiskLevel", "integer", "0 normal, 1 watch, 2 severe; uses risk max when source conflicts.", "Monthly_Panel"],
        ["droughtRiskConflict", "boolean", "True when duplicated source rows disagree on risk class.", "Monthly_Panel"],
        ["droughtRiskValuesRaw", "string", "All distinct drought risk values in source rows.", "Monthly_Panel"],
        ["qualityFlags", "string", "Semicolon-delimited import/audit flags.", "Monthly_Panel"],
        ["source rows", "string", "Excel source row numbers retained for raw-data traceability.", "Monthly_Panel"],
    ]
    return pd.DataFrame(rows, columns=["field", "type", "definition", "sheet"])


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    drought = read_source(DROUGHT_XLSX, "Drought_Risk", "Drought.xlsx")
    rainfall = read_source(RAINFALL_XLSX, "Best_Station_Rainfall", "Rainfall.xlsx")
    drought["source_sheet"] = "Master_Data_Drought_Final"
    rainfall["source_sheet"] = "Master_Data_RainFall_Final"

    if not drought[KEY_COLS].reset_index(drop=True).equals(rainfall[KEY_COLS].reset_index(drop=True)):
        raise RuntimeError("Drought and rainfall workbook keys are not aligned in source row order.")

    canonical_df, geodata_df = load_canonical_geography()
    area_source = drought[["ID", "TAMBON_E", "AMPHOE_E", "Irrigation_Status"]].drop_duplicates()
    crosswalk = build_area_crosswalk(area_source, geodata_df)
    panel, conflicts = build_panel(rainfall, drought, crosswalk)
    quality = build_quality_summary(rainfall, drought, panel, crosswalk)
    attention_flags = build_attention_flags(panel, crosswalk)
    duplicate_audit = build_duplicate_audit(rainfall, drought)
    resolution_rules = build_resolution_rules()
    contract = build_data_contract()

    manifest = pd.DataFrame(
        [
            ["generatedAt", "2026-08-31 Asia/Bangkok"],
            ["sourceDroughtWorkbook", str(DROUGHT_XLSX)],
            ["sourceRainfallWorkbook", str(RAINFALL_XLSX)],
            ["canonicalProvinceId", PROVINCE_ID],
            ["canonicalProvinceCode", PROVINCE_CODE],
            ["canonicalProvinceNameTh", PROVINCE_TH],
            ["canonicalDistricts", str(canonical_df["districtCode"].nunique())],
            ["canonicalSubdistricts", str(canonical_df["subdistrictCode"].nunique())],
            ["normalizedPanelRows", str(len(panel))],
            ["attentionFlagRows", str(len(attention_flags))],
            ["duplicateAuditRows", str(len(duplicate_audit))],
            ["periodMin", str(panel["period"].min())],
            ["periodMax", str(panel["period"].max())],
            ["provenancePolicy", "Rainfall and drought values are DERIVED research workbook values until source/station lineage is confirmed."],
            ["droughtConflictPolicy", "Use conservative maximum as droughtRiskLevel and keep droughtRiskConflict=true plus raw values/source rows."],
            ["operationalPrecedencePolicy", "When approved operational data conflicts with this workbook, approved operational data prevails for live operations."],
        ],
        columns=["key", "value"],
    )

    outputs = {
        "README": manifest,
        "Monthly_Panel": panel,
        "Area_Crosswalk": crosswalk,
        "Drought_Conflicts": conflicts,
        "Attention_Flags": attention_flags,
        "Duplicate_Audit": duplicate_audit,
        "Resolution_Rules": resolution_rules,
        "Quality_Summary": quality,
        "Data_Contract": contract,
        "Raw_Drought": drought,
        "Raw_Rainfall": rainfall,
    }

    sheet_meta = []
    for sheet, df in outputs.items():
        path = OUT / f"{sheet}.csv"
        df.to_csv(path, index=False)
        sheet_meta.append(
            {
                "sheet": sheet,
                "csv": str(path),
                "rows_with_header": len(df) + 1,
                "cols": len(df.columns),
            }
        )
    (OUT / "sheet_meta.json").write_text(json.dumps(sheet_meta, ensure_ascii=False, indent=2))

    print(
        json.dumps(
            {
                "output_dir": str(OUT),
                "sheets": sheet_meta,
                "crosswalk_rows": len(crosswalk),
                "panel_rows": len(panel),
                "drought_conflicts": len(conflicts),
                "attention_flags": len(attention_flags),
                "duplicate_audit_rows": len(duplicate_audit),
                "rainfall_raw_rows": len(rainfall),
                "drought_raw_rows": len(drought),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
