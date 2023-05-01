use syn::{parse_macro_input, DeriveInput, Data::*};
use quote::{quote, format_ident};
use proc_macro::TokenStream;

#[proc_macro_attribute]
pub fn wasmtools_struct(attr: TokenStream, input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);

    let name = &input.ident;
    let parser_name = format_ident!("{}", attr.to_string());
    let data = if let Struct(data) = &input.data {
        data
    } else {
        panic!("wasm_struct only works with structs")
    };

    // wasm-tools data -> our wasm-bindgen'd data
    let mut fields = quote! {};
    fields.extend(data.fields.iter().map(|f| {
        let name = &f.ident;
        quote! {
            #name: value.#name,
        }
    }));
    let impl_from = quote! {
        impl From<#parser_name> for #name {
            fn from(value: #parser_name) -> Self {
                Self {
                    #fields
                }
            }
        }
    };
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
        const TS_APPEND_CONTENT: &'static str = #impl_error_ts_def;
    };

    // result type to encapsulate value + error + offset
    let result_name = format_ident!("{}Result", name);
    let result_type = quote! {
        pub enum #result_name {
            Ok(#name),
            Err(BinaryError),
        }
    };

    // Custom array type for better TypeScript + conversions
    let rust_array_name = format_ident!("{}Array", name);
    let ts_array_type = format!("Array<{} | BinaryError>", name);
    let ts_array = quote! {
        #[wasm_bindgen]
        extern "C" {
            #[derive(Clone)]
            #[wasm_bindgen(typescript_type = #ts_array_type)]
            pub type #rust_array_name;
        }
    };
    let impl_from_array = quote! {
        impl From<Vec<#result_name>> for #rust_array_name {
            fn from(value: Vec<#result_name>) -> Self {
                let arr: Array = value.into_iter().map(|v| match v {
                    #result_name::Ok(ok) => JsValue::from(ok),
                    #result_name::Err(err) => JsValue::from(err),
                }).collect();
                arr.unchecked_into::<#rust_array_name>()
            }
        }
    };

    let output = quote! {
        #[derive(Debug, Copy, Clone, PartialEq, Eq, Hash)]
        #[wasm_bindgen]
        #input
        #impl_error
        #impl_error_ts
        #result_type
        #impl_from
        #ts_array
        #impl_from_array
    };
    output.into()
}
