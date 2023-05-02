use proc_macro2::Ident;
use syn::{parse_macro_input, DeriveInput};
use quote::{quote, format_ident, ToTokens};
use proc_macro::TokenStream;
use proc_macro2::TokenStream as TokenStream2;

// Adapted from adapter2ts in wasm-bindgen:
// https://github.com/rustwasm/wasm-bindgen/blob/0753bec4c6f51d7e27b82c357e65cefab3c61dd3/crates/cli-support/src/js/binding.rs#L1275
fn ident2ts(ty: String) -> String {
    match ty.as_str() {
        "i32"
        | "s8"
        | "s16"
        | "s32"
        | "u8"
        | "u16"
        | "u32"
        | "f32"
        | "f64" => "number",
        "i64" | "s64" | "u64" => "bigint",
        "String" => "string",
        // TODO: Externref
        "bool" => "bool",
        // TODO: Vector
        // TODO: Option
        // TODO: NamedExternref
        _ => ty.as_str(),
    }.to_string()
}

#[proc_macro_attribute]
pub fn wasmtools_enum(_: TokenStream, input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    let name = &input.ident;

    let enum_data = match input.data {
        syn::Data::Enum(data) => data,
        _ => panic!("wasmtools_enum only works with enums"),
    };

    let mut struct_fields = quote! {};
    let mut js_types: Vec<String> = vec![];
    for variant in enum_data.variants {
        let field_name = &variant.ident;
        match variant.fields {
            syn::Fields::Unit => {
                js_types.push(format!(
                    "{{ kind: \"{}\" }}",
                    variant.ident.to_string(),
                ));
            },
            syn::Fields::Unnamed(variant_fields) => {
                if variant_fields.unnamed.len() > 1 {
                    panic!("wasmtools_enum does not support more than one field per variant");
                }

                let ty = &variant_fields.unnamed[0].ty;
                let type_name = match ty {
                    syn::Type::Path(p) => {
                        &p.path.segments[0].ident
                    },
                    _ => panic!("wasmtools_enum does not support that kind of enum field type"),
                };
                let field_type = ty.to_token_stream();
                let ts_field_type = ident2ts(type_name.to_string());

                struct_fields.extend(quote! {
                    pub #field_name: Option<#field_type>,
                });
                js_types.push(format!(
                    "{{ kind: \"{}\", {}: {} }}",
                    variant.ident.to_string(),
                    variant.ident.to_string(),
                    ts_field_type,
                ));
            },
            syn::Fields::Named(_) => panic!("wasmtools_enum does not work with named enum fields"),
        }
    }
    let output_struct = quote! {
        #[derive(Debug, Clone, Default)]
        #[wasm_bindgen(getter_with_clone, skip_typescript)]
        pub struct #name {
            pub kind: String,
            #struct_fields
        }
    };
    let ts_def = format!(r#"
export type {} = {{ is_error: false }} & ({});
    "#, name, js_types.join(" | "));
    let ts = quote! {
        #[wasm_bindgen(typescript_custom_section)]
        const _: &'static str = #ts_def;
    };

    let arrays = arrays_and_results(name);

    let output = quote! {
        #output_struct
        #arrays
        #ts
    };
    output.into()
}

#[proc_macro_attribute]
pub fn wasmtools_struct(_: TokenStream, input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    let name = &input.ident;

    // error definition on the type (to enable discriminated union in typescript)
    let impl_error = quote! {
        #[wasm_bindgen]
        impl #name {
            #[wasm_bindgen(getter = error, skip_typescript)]
            pub fn get_error(&self) -> JsValue {
                JsValue::FALSE
            }
        }
    };
    let impl_error_ts_def = format!(r#"
export interface {} {{
  is_error: false;
}}
"#, name);
    let impl_error_ts = quote! {
        #[wasm_bindgen(typescript_custom_section)]
        const _: &'static str = #impl_error_ts_def;
    };

    let arrays = arrays_and_results(name);

    let output = quote! {
        #[derive(Debug, Clone)]
        #[wasm_bindgen(getter_with_clone)]
        #input
        #impl_error
        #impl_error_ts
        #arrays
    };
    output.into()
}

fn arrays_and_results(name: &Ident) -> TokenStream2 {
    // result type to encapsulate value + error + offset
    let result_name = format_ident!("{}Result", name);
    let result_type = quote! {
        pub enum #result_name {
            Ok(#name),
            Err(BinaryError),
        }
    };

    let rust_array_name = format_ident!("{}Array", name);
    let rust_result_array_name = format_ident!("{}ResultArray", name);
    let ts_array_type = format!("Array<{}>", name);
    let ts_result_array_type = format!("Array<{} | BinaryError>", name);
    let ts_array = quote! {
        #[wasm_bindgen]
        extern "C" {
            #[derive(Debug, Clone)]
            #[wasm_bindgen(typescript_type = #ts_array_type)]
            pub type #rust_array_name;
            #[derive(Debug, Clone)]
            #[wasm_bindgen(typescript_type = #ts_result_array_type)]
            pub type #rust_result_array_name;
        }
    };
    let impl_from_array = quote! {
        impl From<Vec<#name>> for #rust_array_name {
            fn from(value: Vec<#name>) -> Self {
                let arr: Array = value.into_iter().map(|v| JsValue::from(v)).collect();
                arr.unchecked_into::<#rust_array_name>()
            }
        }
        impl From<Vec<#result_name>> for #rust_result_array_name {
            fn from(value: Vec<#result_name>) -> Self {
                let arr: Array = value.into_iter().map(|v| match v {
                    #result_name::Ok(ok) => JsValue::from(ok),
                    #result_name::Err(err) => JsValue::from(err),
                }).collect();
                arr.unchecked_into::<#rust_result_array_name>()
            }
        }
    };

    quote! {
        #result_type
        #ts_array
        #impl_from_array
    }
}
