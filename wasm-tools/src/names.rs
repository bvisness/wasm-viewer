use wasmparser::Operator;

macro_rules! op_name {
    ($(@$proposal:ident $op:ident $({ $($arg:ident: $argty:ty),* })? => $visit:ident)*) => (
        pub fn op_name(op: &Operator) -> String {
            match op {
                $(
                    Operator::$op$({
                        $($arg: _,)*
                    })? => wasmprinter::operator_name!($op),
                )*
            }.to_string()
        }
    );
}
wasmparser::for_each_operator!(op_name);
