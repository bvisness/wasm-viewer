use types::*;
use wasm_bindgen::prelude::*;
use wasmparser::{
    CodeSectionReader, CustomSectionReader, DataSectionReader, ElementSectionReader,
    ExportSectionReader, FunctionBody as ParserFunctionBody, FunctionSectionReader,
    GlobalSectionReader, ImportSectionReader, MemorySectionReader, NameSectionReader,
    TableSectionReader, TypeSectionReader,
};

mod names;
mod types;

#[wasm_bindgen]
pub fn parse_type_section(data: &[u8], offset: usize) -> Result<TypeResultArray, BinaryError> {
    let reader = TypeSectionReader::new(data, offset)?;
    let results = reader
        .into_iter_with_offsets()
        .map(|r| match r {
            Ok((offset, v)) => TypeResult::Ok(Type {
                t: v.into(),
                offset: offset,
            }),
            Err(err) => TypeResult::Err(err.into()),
        })
        .collect::<Vec<TypeResult>>();
    Ok(results.into())
}

#[wasm_bindgen(getter_with_clone)]
pub struct ImportSection {
    pub imports: ImportResultArray,
    pub range: Range,
}

#[wasm_bindgen]
pub fn parse_import_section(data: &[u8], offset: usize) -> Result<ImportSection, BinaryError> {
    let reader = ImportSectionReader::new(data, offset)?;
    let range = reader.range();
    let results = reader
        .into_iter_with_offsets()
        .map(|r| match r {
            Ok((offset, v)) => ImportResult::Ok(Import::from_wasm(v, offset)),
            Err(err) => ImportResult::Err(err.into()),
        })
        .collect::<Vec<ImportResult>>();
    Ok(ImportSection {
        imports: results.into(),
        range: range.into(),
    })
}

#[wasm_bindgen]
pub fn parse_function_section(
    data: &[u8],
    offset: usize,
) -> Result<FunctionResultArray, BinaryError> {
    let reader = FunctionSectionReader::new(data, offset)?;
    let results = reader
        .into_iter_with_offsets()
        .map(|r| match r {
            Ok((offset, v)) => FunctionResult::Ok(Function {
                type_idx: v,
                offset: offset,
            }),
            Err(err) => FunctionResult::Err(err.into()),
        })
        .collect::<Vec<FunctionResult>>();
    Ok(results.into())
}

#[wasm_bindgen]
pub fn parse_table_section(data: &[u8], offset: usize) -> Result<TableResultArray, BinaryError> {
    let reader = TableSectionReader::new(data, offset)?;
    let results = reader
        .into_iter()
        .map(|r| match r {
            Ok(v) => TableResult::Ok(v.into()),
            Err(err) => TableResult::Err(err.into()),
        })
        .collect::<Vec<TableResult>>();
    Ok(results.into())
}

#[wasm_bindgen]
pub fn parse_memory_section(
    data: &[u8],
    offset: usize,
) -> Result<MemoryTypeResultArray, BinaryError> {
    let reader = MemorySectionReader::new(data, offset)?;
    let results = reader
        .into_iter()
        .map(|r| match r {
            Ok(v) => MemoryTypeResult::Ok(v.into()),
            Err(err) => MemoryTypeResult::Err(err.into()),
        })
        .collect::<Vec<MemoryTypeResult>>();
    Ok(results.into())
}

#[wasm_bindgen]
pub fn parse_global_section(data: &[u8], offset: usize) -> Result<GlobalResultArray, BinaryError> {
    let reader = GlobalSectionReader::new(data, offset)?;
    let results = reader
        .into_iter()
        .map(|r| match r {
            Ok(v) => GlobalResult::Ok(v.into()),
            Err(err) => GlobalResult::Err(err.into()),
        })
        .collect::<Vec<GlobalResult>>();
    Ok(results.into())
}

#[wasm_bindgen]
pub fn parse_export_section(data: &[u8], offset: usize) -> Result<ExportResultArray, BinaryError> {
    let reader = ExportSectionReader::new(data, offset)?;
    let results = reader
        .into_iter()
        .map(|r| match r {
            Ok(v) => ExportResult::Ok(v.into()),
            Err(err) => ExportResult::Err(err.into()),
        })
        .collect::<Vec<ExportResult>>();
    Ok(results.into())
}

// The start section is parsed in JS.

#[wasm_bindgen]
pub fn parse_element_section(
    data: &[u8],
    offset: usize,
) -> Result<ElementResultArray, BinaryError> {
    let reader = ElementSectionReader::new(data, offset)?;
    let results = reader
        .into_iter()
        .map(|r| match r {
            Ok(v) => ElementResult::Ok(v.into()),
            Err(err) => ElementResult::Err(err.into()),
        })
        .collect::<Vec<ElementResult>>();
    Ok(results.into())
}

#[wasm_bindgen]
pub fn parse_code_section(
    data: &[u8],
    offset: usize,
) -> Result<FunctionBodyResultArray, BinaryError> {
    let reader = CodeSectionReader::new(data, offset)?;
    let results = reader
        .into_iter()
        .map(|r| match r {
            Ok(v) => FunctionBodyResult::Ok(v.into()),
            Err(err) => FunctionBodyResult::Err(err.into()),
        })
        .collect::<Vec<FunctionBodyResult>>();
    Ok(results.into())
}

#[wasm_bindgen]
pub fn parse_function_body(data: &[u8], offset: usize) -> Result<OperatorResultArray, BinaryError> {
    let reader = ParserFunctionBody::new(offset, data);
    let ops = reader
        .get_operators_reader()?
        .into_iter()
        .map(|r| match r {
            Ok(v) => OperatorResult::Ok(v.into()),
            Err(err) => OperatorResult::Err(err.into()),
        })
        .collect::<Vec<OperatorResult>>();
    Ok(ops.into())
}

#[wasm_bindgen]
pub fn parse_data_section(data: &[u8], offset: usize) -> Result<DataResultArray, BinaryError> {
    let reader = DataSectionReader::new(data, offset)?;
    let results = reader
        .into_iter()
        .map(|r| match r {
            Ok(v) => DataResult::Ok(v.into()),
            Err(err) => DataResult::Err(err.into()),
        })
        .collect::<Vec<DataResult>>();
    Ok(results.into())
}

#[wasm_bindgen]
pub fn parse_custom_section(data: &[u8], offset: usize) -> Result<CustomSection, BinaryError> {
    let reader = CustomSectionReader::new(data, offset)?;
    Ok(CustomSection {
        name: reader.name().to_string(),
        data: reader.data().to_vec(),
    })
}

#[wasm_bindgen]
pub fn parse_name_section(data: &[u8], offset: usize) -> NameResultArray {
    let reader = NameSectionReader::new(data, offset);
    let results = reader
        .into_iter()
        .map(|r| match r {
            Ok(v) => NameResult::Ok(v.into()),
            Err(err) => NameResult::Err(err.into()),
        })
        .collect::<Vec<NameResult>>();
    results.into()
}
