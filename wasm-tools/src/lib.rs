use types::*;
use wasm_bindgen::prelude::*;
use wasmparser::{GlobalSectionReader, MemorySectionReader, TypeSectionReader};

mod types;

#[wasm_bindgen]
pub fn parse_type_section(data: &[u8], offset: usize) -> Result<TypeResultArray, BinaryError> {
    let reader = TypeSectionReader::new(data, offset)?;
    let mems = reader
        .into_iter()
        .map(|t| match t {
            Ok(ty) => TypeResult::Ok(ty.into()),
            Err(err) => TypeResult::Err(err.into()),
        })
        .collect::<Vec<TypeResult>>();
    Ok(mems.into())
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
            Ok(memory) => MemoryTypeResult::Ok(memory.into()),
            Err(err) => MemoryTypeResult::Err(err.into()),
        })
        .collect::<Vec<MemoryTypeResult>>();
    Ok(mems.into())
}

#[wasm_bindgen]
pub fn parse_global_section(data: &[u8], offset: usize) -> Result<GlobalResultArray, BinaryError> {
    let reader = GlobalSectionReader::new(data, offset)?;
    let mems = reader
        .into_iter()
        .map(|m| match m {
            Ok(global) => GlobalResult::Ok(global.into()),
            Err(err) => GlobalResult::Err(err.into()),
        })
        .collect::<Vec<GlobalResult>>();
    Ok(mems.into())
}
