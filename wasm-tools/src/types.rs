use js_sys::Array;
use macros::*;
use wasm_bindgen::prelude::*;
use wasmparser::{
    BinaryReaderError, ConstExpr as ParserConstExpr, FuncType as ParserFuncType,
    Global as ParserGlobal, GlobalType as ParserGlobalType, Import as ParserImport,
    MemoryType as ParserMemoryType, RefType as ParserRefType, TableType as ParserTableType,
    TagKind as ParserTagKind, TagType as ParserTagType, Type as ParserType,
    TypeRef as ParserTypeRef, ValType as ParserValType,
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
#[wasmtools_enum]
pub enum ValType {
    i32,
    i64,
    f32,
    f64,
    v128,
    ref_type(RefType),
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

/// Represents a type of a function in a WebAssembly module.
#[derive(Debug, Clone)]
#[wasm_bindgen(getter_with_clone)]
pub struct FuncType {
    /// The combined parameters and result types.
    pub params_results: ValTypeArray,
    /// The number of parameter types.
    pub len_params: usize,
}

impl From<ParserFuncType> for FuncType {
    fn from(value: ParserFuncType) -> Self {
        let params_results = value.params().iter().chain(value.results().iter());
        let params_results: Vec<ValType> = params_results.map(|vt| (*vt).into()).collect();
        FuncType {
            params_results: params_results.into(),
            len_params: value.params().len(),
        }
    }
}

/// Represents a type in a WebAssembly module.
#[wasmtools_enum]
pub enum Type {
    func(FuncType),
}

impl From<ParserType> for Type {
    fn from(value: ParserType) -> Self {
        Type {
            kind: match value {
                ParserType::Func(_) => "func",
            }
            .to_string(),
            func: match value {
                ParserType::Func(ft) => Some(ft.into()),
            },
        }
    }
}

/// Represents a reference to a type definition in a WebAssembly module.
#[wasmtools_enum]
pub enum TypeRef {
    func(u32),
    table(TableType),
    memory(MemoryType),
    global(GlobalType),
    tag(TagType),
}

impl From<ParserTypeRef> for TypeRef {
    fn from(value: ParserTypeRef) -> Self {
        match value {
            ParserTypeRef::Func(f) => TypeRef {
                kind: "func".to_string(),
                func: Some(f),
                ..Default::default()
            },
            ParserTypeRef::Table(t) => TypeRef {
                kind: "table".to_string(),
                table: Some(t.into()),
                ..Default::default()
            },
            ParserTypeRef::Global(g) => TypeRef {
                kind: "global".to_string(),
                global: Some(g.into()),
                ..Default::default()
            },
            ParserTypeRef::Memory(m) => TypeRef {
                kind: "memory".to_string(),
                memory: Some(m.into()),
                ..Default::default()
            },
            ParserTypeRef::Tag(t) => TypeRef {
                kind: "tag".to_string(),
                tag: Some(t.into()),
                ..Default::default()
            },
        }
    }
}

/// Represents an import in a WebAssembly module.
#[wasmtools_struct]
pub struct Import {
    /// The module being imported from.
    pub module: String,
    /// The name of the imported item.
    pub name: String,
    /// The type of the imported item.
    pub ty: TypeRef,
}

impl From<ParserImport<'_>> for Import {
    fn from(value: ParserImport) -> Self {
        Import {
            module: value.module.to_string(),
            name: value.name.to_string(),
            ty: value.ty.into(),
        }
    }
}

/// Represents a table's type.
#[wasmtools_struct]
pub struct TableType {
    /// The table's element type.
    pub element_type: RefType,
    /// Initial size of this table, in elements.
    pub initial: u32,
    /// Optional maximum size of the table, in elements.
    pub maximum: Option<u32>,
}

impl From<ParserTableType> for TableType {
    fn from(value: ParserTableType) -> Self {
        TableType {
            element_type: value.element_type.into(),
            initial: value.initial,
            maximum: value.maximum,
        }
    }
}

/// Represents a tag kind.
#[wasmtools_enum]
pub enum TagKind {
    /// The tag is an exception type.
    exception,
}

impl From<ParserTagKind> for TagKind {
    fn from(value: ParserTagKind) -> Self {
        match value {
            ParserTagKind::Exception => TagKind {
                kind: "exception".to_string(),
            },
        }
    }
}

/// A tag's type.
#[wasmtools_struct]
pub struct TagType {
    /// The kind of tag
    pub kind: TagKind,
    /// The function type this tag uses.
    pub func_type_idx: u32,
}

impl From<ParserTagType> for TagType {
    fn from(value: ParserTagType) -> Self {
        TagType {
            kind: value.kind.into(),
            func_type_idx: value.func_type_idx,
        }
    }
}

#[wasmtools_struct]
pub struct Function {
    pub type_idx: u32,
}

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
