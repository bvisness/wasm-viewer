use types::*;
use wasm_bindgen::prelude::*;
use wasmparser::MemorySectionReader;

mod types;

#[wasm_bindgen]
pub fn parse_memory_section(data: &[u8], offset: usize) -> Result<MemoryTypeArray, BinaryError> {
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
