use js_sys::Array;
use macros::wasmtools_struct;
use wasm_bindgen::prelude::*;
use wasmparser::{
    BinaryReaderError, ConstExpr as ParserConstExpr, Global as ParserGlobal,
    GlobalType as ParserGlobalType, MemoryType as ParserMemoryType, RefType as ParserRefType,
    ValType as ParserValType,
};

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
const _: &'static str = r#"
interface BinaryError {
  is_error: true;
}
"#;

impl From<BinaryReaderError> for BinaryError {
    fn from(value: BinaryReaderError) -> Self {
        BinaryError {
            message: value.message().to_string(),
            offset: value.offset(),
        }
    }
}

// Stuff in here is copy-pasted from wasm-tools and set up with macros to
// alleviate the enormous amount of repetition it takes to send these types
// to JS.

/// Represents a memory's type.
#[wasmtools_struct]
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

impl From<ParserMemoryType> for MemoryType {
    fn from(value: ParserMemoryType) -> Self {
        MemoryType {
            memory64: value.memory64,
            shared: value.shared,
            initial: value.initial,
            maximum: value.maximum,
        }
    }
}

/// A reference type.
///
/// The reference types proposal first introduced `externref` and `funcref`.
///
/// The function refererences proposal introduced typed function references.
#[derive(Debug, Clone)]
#[wasm_bindgen(getter_with_clone)]
pub struct RefType {
    /// "type", "func", or "extern"
    pub kind: String,
    pub nullable: bool,
    /// If kind is "type", the index of the type being referenced
    pub type_index: Option<u32>,
}

impl From<ParserRefType> for RefType {
    fn from(value: ParserRefType) -> Self {
        RefType {
            kind: match value.heap_type() {
                wasmparser::HeapType::Extern => "extern",
                wasmparser::HeapType::Func => "func",
                wasmparser::HeapType::TypedFunc(_) => "type",
            }
            .to_string(),
            nullable: value.is_nullable(),
            type_index: match value.heap_type() {
                wasmparser::HeapType::TypedFunc(idx) => Some(idx),
                _ => None,
            },
        }
    }
}

/// Represents the types of values in a WebAssembly module.
#[derive(Debug, Clone)]
#[wasm_bindgen(getter_with_clone)]
pub struct ValType {
    /// "i32", "i64", "f32", "f64", "v128", or "ref"
    pub kind: String,
    /// If kind == "ref", the reference type
    pub ref_type: Option<RefType>,
}

impl From<ParserValType> for ValType {
    fn from(value: ParserValType) -> Self {
        ValType {
            kind: match value {
                ParserValType::I32 => "i32",
                ParserValType::I64 => "i64",
                ParserValType::F32 => "f32",
                ParserValType::F64 => "f64",
                ParserValType::V128 => "v128",
                ParserValType::Ref(_) => "ref",
            }
            .to_string(),
            ref_type: match value {
                ParserValType::Ref(rt) => Some(rt.into()),
                _ => None,
            },
        }
    }
}

/// Represents a global's type.
#[derive(Debug, Clone)]
#[wasm_bindgen(getter_with_clone)]
pub struct GlobalType {
    /// The global's type.
    pub content_type: ValType,
    /// Whether or not the global is mutable.
    pub mutable: bool,
}

impl From<ParserGlobalType> for GlobalType {
    fn from(value: ParserGlobalType) -> Self {
        GlobalType {
            content_type: value.content_type.into(),
            mutable: value.mutable,
        }
    }
}

/// Represents an initialization expression.
#[derive(Debug, Clone)]
#[wasm_bindgen(getter_with_clone)]
pub struct ConstExpr {
    pub data: Vec<u8>,
}

impl From<ParserConstExpr<'_>> for ConstExpr {
    fn from(value: ParserConstExpr) -> Self {
        let mut reader = value.get_binary_reader();
        let bytes = reader.read_bytes(reader.bytes_remaining());
        ConstExpr {
            data: bytes.unwrap().into(),
        }
    }
}

/// Represents a core WebAssembly global.
#[wasmtools_struct]
pub struct Global {
    /// The global's type.
    pub ty: GlobalType,
    /// The global's initialization expression.
    pub init_expr: ConstExpr,
}

impl From<ParserGlobal<'_>> for Global {
    fn from(value: ParserGlobal) -> Self {
        Global {
            ty: value.ty.into(),
            init_expr: value.init_expr.into(),
        }
    }
}
