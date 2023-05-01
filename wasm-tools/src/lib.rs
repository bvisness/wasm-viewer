use wasm_bindgen::prelude::*;
use wasmparser::{MemorySectionReader, MemoryType};
use js_sys::{Array};

#[wasm_bindgen]
extern "C" {
  fn alert(s: &str);
}

#[wasm_bindgen]
pub fn greet(name: &str) {
  alert(&format!("Hello, {}!", name));
}

#[wasm_bindgen]
extern "C" {
  #[wasm_bindgen(typescript_type = "Array<MemoryType>")]
  pub type MemoryTypeArray;
}

#[wasm_bindgen]
pub fn parse_memory_section(data: &[u8], offset: usize) -> MemoryTypeArray {
  match MemorySectionReader::new(data, offset) {
    Ok(memory_section) => {
      let mut mems: Vec<WasmMemoryType> = vec![];
      for x in memory_section.into_iter_with_offsets() {
        match x {
          Ok((offset, memory)) => {
            mems.push(memory.into())
          },
          Err(_) => todo!(),
        }
      }
      let arr: Array = mems.into_iter().map(JsValue::from).collect();
      arr.unchecked_into::<MemoryTypeArray>()
    },
    Err(_) => todo!(),
  }
}

#[wasm_bindgen(js_name = MemoryType)]
pub struct WasmMemoryType {
  /// Whether or not this is a 64-bit memory, using i64 as an index. If this
  /// is false it's a 32-bit memory using i32 as an index.
  ///
  /// This is part of the memory64 proposal in WebAssembly.
  pub memory64: bool,

  /// Whether or not this is a "shared" memory, indicating that it should be
  /// send-able across threads and the `maximum` field is always present for
  /// valid types.
  ///
  /// This is part of the threads proposal in WebAssembly.
  pub shared: bool,

  /// Initial size of this memory, in wasm pages.
  ///
  /// For 32-bit memories (when `memory64` is `false`) this is guaranteed to
  /// be at most `u32::MAX` for valid types.
  pub initial: u64,

  /// Optional maximum size of this memory, in wasm pages.
  ///
  /// For 32-bit memories (when `memory64` is `false`) this is guaranteed to
  /// be at most `u32::MAX` for valid types. This field is always present for
  /// valid wasm memories when `shared` is `true`.
  pub maximum: Option<u64>,
}

impl From<MemoryType> for WasmMemoryType {
  fn from(value: MemoryType) -> Self {
    Self { memory64: value.memory64, shared: value.shared, initial: value.initial, maximum: value.maximum }
  }
}
