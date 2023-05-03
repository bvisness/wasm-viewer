use js_sys::Array;
use macros::*;
use wasm_bindgen::prelude::*;
use wasmparser::{
    BinaryReaderError, ConstExpr as ParserConstExpr, Data as ParserData,
    DataKind as ParserDataKind, Element as ParserElement, ElementItems as ParserElementItems,
    ElementKind as ParserElementKind, Export as ParserExport, ExternalKind as ParserExternalKind,
    FuncType as ParserFuncType, Global as ParserGlobal, GlobalType as ParserGlobalType,
    Import as ParserImport, MemoryType as ParserMemoryType, RefType as ParserRefType,
    Table as ParserTable, TableInit as ParserTableInit, TableType as ParserTableType,
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
#[wasmtools_struct]
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
        match value {
            ParserValType::I32 => ValType::new_i32(),
            ParserValType::I64 => ValType::new_i64(),
            ParserValType::F32 => ValType::new_f32(),
            ParserValType::F64 => ValType::new_f64(),
            ParserValType::V128 => ValType::new_v128(),
            ParserValType::Ref(r) => ValType::new_ref_type(r.into()),
        }
    }
}

/// Represents a type of a function in a WebAssembly module.
#[wasmtools_struct]
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
        match value {
            ParserType::Func(f) => Type::new_func(f.into()),
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
            ParserTypeRef::Func(f) => TypeRef::new_func(f),
            ParserTypeRef::Table(t) => TypeRef::new_table(t.into()),
            ParserTypeRef::Global(g) => TypeRef::new_global(g.into()),
            ParserTypeRef::Memory(m) => TypeRef::new_memory(m.into()),
            ParserTypeRef::Tag(t) => TypeRef::new_tag(t.into()),
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
            ParserTagKind::Exception => TagKind::new_exception(),
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

/// Different modes of initializing a table.
#[wasmtools_enum]
pub enum TableInit {
    /// The table is initialized to all null elements.
    ref_null,
    /// Each element in the table is initialized with the specified constant
    /// expression.
    expr(ConstExpr),
}

impl From<ParserTableInit<'_>> for TableInit {
    fn from(value: ParserTableInit) -> Self {
        match value {
            ParserTableInit::Expr(expr) => TableInit::new_expr(expr.into()),
            ParserTableInit::RefNull => TableInit::new_ref_null(),
        }
    }
}

/// Type information about a table defined in the table section of a WebAssembly
/// module.
#[wasmtools_struct]
pub struct Table {
    /// The type of this table, including its element type and its limits.
    pub ty: TableType,
    /// The initialization expression for the table.
    pub init: TableInit,
}

impl From<ParserTable<'_>> for Table {
    fn from(value: ParserTable) -> Self {
        Table {
            ty: value.ty.into(),
            init: value.init.into(),
        }
    }
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
#[wasmtools_struct]
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
#[wasmtools_struct]
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

/// External types as defined [here].
///
/// [here]: https://webassembly.github.io/spec/core/syntax/types.html#external-types
#[wasmtools_enum]
pub enum ExternalKind {
    /// The external kind is a function.
    func,
    /// The external kind if a table.
    table,
    /// The external kind is a memory.
    memory,
    /// The external kind is a global.
    global,
    /// The external kind is a tag.
    tag,
}

impl From<ParserExternalKind> for ExternalKind {
    fn from(value: ParserExternalKind) -> Self {
        match value {
            ParserExternalKind::Func => ExternalKind::new_func(),
            ParserExternalKind::Table => ExternalKind::new_table(),
            ParserExternalKind::Memory => ExternalKind::new_memory(),
            ParserExternalKind::Global => ExternalKind::new_global(),
            ParserExternalKind::Tag => ExternalKind::new_tag(),
        }
    }
}

/// Represents an export in a WebAssembly module.
#[wasmtools_struct]
pub struct Export {
    /// The name of the exported item.
    pub name: String,
    /// The kind of the export.
    pub kind: ExternalKind,
    /// The index of the exported item.
    pub index: u32,
}

impl From<ParserExport<'_>> for Export {
    fn from(value: ParserExport<'_>) -> Self {
        Export {
            name: value.name.to_string(),
            kind: value.kind.into(),
            index: value.index,
        }
    }
}

#[wasmtools_struct]
pub struct ElementKindActive {
    /// The index of the table being initialized.
    pub table_index: u32,
    /// The initial expression of the element segment.
    pub offset_expr: ConstExpr,
}

/// The kind of element segment.
#[wasmtools_enum]
pub enum ElementKind {
    /// The element segment is passive.
    passive,
    /// The element segment is active.
    active(ElementKindActive),
    /// The element segment is declared.
    declared,
}

impl From<ParserElementKind<'_>> for ElementKind {
    fn from(value: ParserElementKind) -> Self {
        match value {
            ParserElementKind::Passive => ElementKind::new_passive(),
            ParserElementKind::Active {
                table_index,
                offset_expr,
            } => ElementKind::new_active(ElementKindActive {
                table_index: table_index.unwrap_or(0),
                offset_expr: offset_expr.into(),
            }),
            ParserElementKind::Declared => ElementKind::new_declared(),
        }
    }
}

/// Represents the items of an element segment.
#[wasmtools_enum]
pub enum ElementItems {
    /// This element contains function indices.
    functions(Vec<u32>),
    /// This element contains constant expressions used to initialize the table.
    expressions(ConstExprArray),
}

impl From<ParserElementItems<'_>> for ElementItems {
    fn from(value: ParserElementItems) -> Self {
        match value {
            ParserElementItems::Functions(funcs) => {
                let fs = funcs.into_iter().map(|f| f.unwrap()).collect();
                ElementItems::new_functions(fs)
            }
            ParserElementItems::Expressions(exprs) => {
                let es: Vec<ConstExpr> = exprs.into_iter().map(|e| e.unwrap().into()).collect();
                ElementItems::new_expressions(es.into())
            }
        }
    }
}

/// Represents a core WebAssembly element segment.
#[wasmtools_struct]
pub struct Element {
    /// The kind of the element segment.
    pub kind: ElementKind,
    /// The initial elements of the element segment.
    pub items: ElementItems,
    /// The type of the elements.
    pub ty: RefType,
    // /// The range of the the element segment.
    // pub range: Range<usize>,
}

impl From<ParserElement<'_>> for Element {
    fn from(value: ParserElement) -> Self {
        Element {
            kind: value.kind.into(),
            items: value.items.into(),
            ty: value.ty.into(),
        }
    }
}

#[wasmtools_struct]
pub struct DataKindActive {
    /// The memory index for the data segment.
    pub memory_index: u32,
    /// The initialization expression for the data segment.
    pub offset_expr: ConstExpr,
}

/// The kind of data segment.
#[wasmtools_enum]
pub enum DataKind {
    /// The data segment is passive.
    passive,
    /// The data segment is active.
    active(DataKindActive),
}

impl From<ParserDataKind<'_>> for DataKind {
    fn from(value: ParserDataKind) -> Self {
        match value {
            ParserDataKind::Passive => DataKind::new_passive(),
            ParserDataKind::Active {
                memory_index,
                offset_expr,
            } => DataKind::new_active(DataKindActive {
                memory_index: memory_index,
                offset_expr: offset_expr.into(),
            }),
        }
    }
}

/// Represents a data segment in a core WebAssembly module.
#[wasmtools_struct]
pub struct Data {
    /// The kind of data segment.
    pub kind: DataKind,
    /// The data of the data segment.
    pub data: Vec<u8>,
    // /// The range of the data segment.
    // pub range: Range<usize>,
}

impl From<ParserData<'_>> for Data {
    fn from(value: ParserData) -> Self {
        Data {
            kind: value.kind.into(),
            data: value.data.to_vec(),
        }
    }
}
