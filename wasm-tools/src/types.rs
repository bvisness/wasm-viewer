use js_sys::Array;
use macros::wasmtools_struct;
use wasm_bindgen::prelude::*;
use wasmparser::{MemoryType as ParserMemoryType, BinaryReaderError};

#[wasm_bindgen(getter_with_clone)]
pub struct BinaryError {
    pub message: String,
    pub offset: usize,
}

#[wasm_bindgen]
impl BinaryError {
    #[wasm_bindgen(getter = is_error, skip_typescript)]
    pub fn get_is_error(&self) -> JsValue {
        JsValue::TRUE
    }
}

#[wasm_bindgen(typescript_custom_section)]
const TS_APPEND_CONTENT: &'static str = r#"
interface BinaryError {
  is_error: true;
}
"#;

impl From<BinaryReaderError> for BinaryError {
    fn from(value: BinaryReaderError) -> Self {
        BinaryError{
            message: value.message().to_string(),
            offset: value.offset(),
        }
    }
}

// Stuff in here is copy-pasted from wasm-tools and set up with macros to
// alleviate the enormous amount of repetition it takes to send these types
// to JS.

#[wasmtools_struct(ParserMemoryType)]
pub struct MemoryType {
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
