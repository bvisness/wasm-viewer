use types::*;
use wasm_bindgen::prelude::*;
use wasmparser::{
    ElementSectionReader, ExportSectionReader, FunctionSectionReader, GlobalSectionReader,
    ImportSectionReader, MemorySectionReader, TableSectionReader, TypeSectionReader,
};

mod types;

#[wasm_bindgen]
pub fn parse_type_section(data: &[u8], offset: usize) -> Result<TypeResultArray, BinaryError> {
    let reader = TypeSectionReader::new(data, offset)?;
    let types = reader
        .into_iter()
        .map(|r| match r {
            Ok(v) => TypeResult::Ok(v.into()),
            Err(err) => TypeResult::Err(err.into()),
        })
        .collect::<Vec<TypeResult>>();
    Ok(types.into())
}

#[wasm_bindgen]
pub fn parse_import_section(data: &[u8], offset: usize) -> Result<ImportResultArray, BinaryError> {
    let reader = ImportSectionReader::new(data, offset)?;
    let imports = reader
        .into_iter()
        .map(|r| match r {
            Ok(v) => ImportResult::Ok(v.into()),
            Err(err) => ImportResult::Err(err.into()),
        })
        .collect::<Vec<ImportResult>>();
    Ok(imports.into())
}

#[wasm_bindgen]
pub fn parse_function_section(
    data: &[u8],
    offset: usize,
) -> Result<FunctionResultArray, BinaryError> {
    let reader = FunctionSectionReader::new(data, offset)?;
    let imports = reader
        .into_iter()
        .map(|r| match r {
            Ok(v) => FunctionResult::Ok(Function { type_idx: v }),
            Err(err) => FunctionResult::Err(err.into()),
        })
        .collect::<Vec<FunctionResult>>();
    Ok(imports.into())
}

#[wasm_bindgen]
pub fn parse_table_section(data: &[u8], offset: usize) -> Result<TableResultArray, BinaryError> {
    let reader = TableSectionReader::new(data, offset)?;
    let imports = reader
        .into_iter()
        .map(|r| match r {
            Ok(v) => TableResult::Ok(v.into()),
            Err(err) => TableResult::Err(err.into()),
        })
        .collect::<Vec<TableResult>>();
    Ok(imports.into())
}

#[wasm_bindgen]
pub fn parse_memory_section(
    data: &[u8],
    offset: usize,
) -> Result<MemoryTypeResultArray, BinaryError> {
    let reader = MemorySectionReader::new(data, offset)?;
    let mems = reader
        .into_iter()
        .map(|m| match m {
            Ok(v) => MemoryTypeResult::Ok(v.into()),
            Err(err) => MemoryTypeResult::Err(err.into()),
        })
        .collect::<Vec<MemoryTypeResult>>();
    Ok(mems.into())
}

#[wasm_bindgen]
pub fn parse_global_section(data: &[u8], offset: usize) -> Result<GlobalResultArray, BinaryError> {
    let reader = GlobalSectionReader::new(data, offset)?;
    let globals = reader
        .into_iter()
        .map(|g| match g {
            Ok(v) => GlobalResult::Ok(v.into()),
            Err(err) => GlobalResult::Err(err.into()),
        })
        .collect::<Vec<GlobalResult>>();
    Ok(globals.into())
}

#[wasm_bindgen]
pub fn parse_export_section(data: &[u8], offset: usize) -> Result<ExportResultArray, BinaryError> {
    let reader = ExportSectionReader::new(data, offset)?;
    let globals = reader
        .into_iter()
        .map(|g| match g {
            Ok(v) => ExportResult::Ok(v.into()),
            Err(err) => ExportResult::Err(err.into()),
        })
        .collect::<Vec<ExportResult>>();
    Ok(globals.into())
}

// The start section is parsed in JS.

#[wasm_bindgen]
pub fn parse_element_section(
    data: &[u8],
    offset: usize,
) -> Result<ElementResultArray, BinaryError> {
    let reader = ElementSectionReader::new(data, offset)?;
    let globals = reader
        .into_iter()
        .map(|r| match r {
            Ok(v) => ElementResult::Ok(v.into()),
            Err(err) => ElementResult::Err(err.into()),
        })
        .collect::<Vec<ElementResult>>();
    Ok(globals.into())
}
