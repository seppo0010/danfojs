"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.DataFrame = void 0;

var _generic = _interopRequireDefault(require("./generic"));

var _series = require("./series");

var tf = _interopRequireWildcard(require("@tensorflow/tfjs-node"));

var _utils = require("./utils");

var _groupby = require("./groupby");

var _merge = require("./merge");

var _mathjs = require("mathjs");

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const utils = new _utils.Utils();

class DataFrame extends _generic.default {
  constructor(data, kwargs) {
    super(data, kwargs);

    this.__set_column_property();
  }

  __set_column_property() {
    let col_vals = this.col_data;
    let col_names = this.column_names;
    col_vals.forEach((col, i) => {
      this[col_names[i]] = new _series.Series(col, {
        columns: col_names[i],
        index: this.index
      });
    });
  }

  drop(val, kwargs = {
    axis: 0,
    inplace: false
  }) {
    if (kwargs['axis'] == 1) {
      const index = this.columns.indexOf(val);
      const values = this.values;

      if (index == -1) {
        throw new Error(`column "${val}" does not exist`);
      }

      let new_data = values.map(function (element) {
        let new_arr = utils.remove(element, index);
        return new_arr;
      });

      if (!kwargs['inplace']) {
        let columns = utils.remove(this.columns, index);
        return new DataFrame(new_data, {
          columns: columns
        });
      } else {
        this.columns = utils.remove(this.columns, index);
        this.data_tensor = tf.tensor(new_data);
        this.data = new_data;
      }
    } else {
      const axes = this.axes;
      const isIndex = axes["index"].includes(val);
      const values = this.values;

      if (isIndex) {
        var index = val;
      } else {
        throw new Error("Index does not exist");
      }

      let new_data = utils.remove(values, index);

      if (!kwargs['inplace']) {
        return new DataFrame(new_data, {
          columns: this.columns
        });
      } else {
        this.data_tensor = tf.tensor(new_data);
        this.data = new_data;
      }
    }
  }

  __indexLoc(kwargs) {
    let rows = null;
    let columns = null;
    let isColumnSplit = false;

    if (Object.prototype.hasOwnProperty.call(kwargs, "rows")) {
      if (Array.isArray(kwargs["rows"])) {
        if (kwargs["rows"].length == 1 && typeof kwargs["rows"][0] == "string") {
          if (kwargs["rows"][0].includes(":")) {
            let row_split = kwargs["rows"][0].split(":");
            let start = parseInt(row_split[0]) || 0;
            let end = parseInt(row_split[1]) || this.values.length - 1;

            if (typeof start == "number" && typeof end == "number") {
              rows = utils.__range(start, end);
            }
          } else {
            throw new Error("numbers in string must be separated by ':'");
          }
        } else {
          rows = kwargs["rows"];
        }
      } else {
        throw new Error("rows must be a list");
      }
    } else {
      throw new Error("Kwargs keywords are {rows, columns}");
    }

    if (Object.prototype.hasOwnProperty.call(kwargs, "columns")) {
      if (Array.isArray(kwargs["columns"])) {
        if (kwargs["columns"].length == 1 && kwargs["columns"][0].includes(":")) {
          let row_split = kwargs["columns"][0].split(":");
          let start, end;

          if (kwargs["type"] == "iloc" || row_split[0] == "") {
            start = parseInt(row_split[0]) || 0;
            end = parseInt(row_split[1]) || this.values[0].length - 1;
          } else {
            start = parseInt(this.columns.indexOf(row_split[0]));
            end = parseInt(this.columns.indexOf(row_split[1]));
          }

          if (typeof start == "number" && typeof end == "number") {
            columns = utils.__range(start, end);
            isColumnSplit = true;
          }
        } else {
          columns = kwargs["columns"];
        }
      } else {
        throw new Error("columns must be a list");
      }
    } else {
      throw new Error("Kwargs keywords are {rows, columns}");
    }

    let data_values = this.values;
    let new_data = [];

    for (var index = 0; index < rows.length; index++) {
      let row_val = rows[index];
      let max_rowIndex = data_values.length - 1;

      if (row_val > max_rowIndex) {
        throw new Error(`Specified row index ${row_val} is bigger than maximum row index of ${max_rowIndex}`);
      }

      let value = data_values[row_val];
      let row_data = [];

      for (var i in columns) {
        var col_index;

        if (kwargs["type"] == "loc" && !isColumnSplit) {
          col_index = this.columns.indexOf(columns[i]);

          if (col_index == -1) {
            throw new Error(`Column ${columns[i]} does not exist`);
          }
        } else {
          col_index = columns[i];
          let max_colIndex = this.columns.length - 1;

          if (col_index > max_colIndex) {
            throw new Error(`column index ${col_index} is bigger than ${max_colIndex}`);
          }
        }

        let elem = value[col_index];
        row_data.push(elem);
      }

      new_data.push(row_data);
    }

    let column_names = [];

    if (kwargs["type"] == "iloc" || isColumnSplit) {
      columns.map(col => {
        column_names.push(this.columns[col]);
      });
    } else {
      column_names = columns;
    }

    return [new_data, column_names, rows];
  }

  loc(kwargs) {
    kwargs["type"] = "loc";

    let [new_data, columns, rows] = this.__indexLoc(kwargs);

    let df_columns = {
      "columns": columns
    };
    let df = new DataFrame(new_data, df_columns);
    df.index_arr = rows;
    return df;
  }

  iloc(kwargs) {
    kwargs["type"] = "iloc";

    let [new_data, columns, rows] = this.__indexLoc(kwargs);

    let df_columns = {
      "columns": columns
    };
    let df = new DataFrame(new_data, df_columns);
    df.index_arr = rows;
    return df;
  }

  head(rows = 5) {
    if (rows > this.values.length || rows < 1) {
      let config = {
        columns: this.column_names
      };
      return new DataFrame(this.values, config);
    } else {
      let data = this.values.slice(0, rows);
      let idx = this.index.slice(0, rows);
      let config = {
        columns: this.column_names,
        index: idx
      };
      return new DataFrame(data, config);
    }
  }

  tail(rows = 5) {
    let row_len = this.values.length;

    if (rows > row_len || rows < 1) {
      let config = {
        columns: this.column_names
      };
      return new DataFrame(this.values, config);
    } else {
      let data = this.values.slice(row_len - rows);
      let indx = this.index.slice(row_len - rows);
      let config = {
        columns: this.column_names,
        index: indx
      };
      let df = new DataFrame(data, config);
      return df;
    }
  }

  sample(num = 5) {
    if (num > this.values.length || num < 1) {
      let config = {
        columns: this.column_names
      };
      return new DataFrame(this.values, config);
    } else {
      let values = this.values;
      let idx = this.index;
      let new_values = [];
      let new_idx = [];
      let counts = [...Array(idx.length).keys()];

      let rand_nums = utils.__sample_from_iter(counts, num, false);

      rand_nums.map(i => {
        new_values.push(values[i]);
        new_idx.push(idx[i]);
      });
      let config = {
        columns: this.column_names,
        index: new_idx
      };
      let df = new DataFrame(new_values, config);
      return df;
    }
  }

  add(other, axis) {
    if (this.__frame_is_compactible_for_operation) {
      let tensors = this.__get_ops_tensors([this, other], axis);

      let sum_vals = tensors[0].add(tensors[1]);
      let col_names = this.columns;
      return this.__get_df_from_tensor(sum_vals, col_names);
    } else {
      throw Error("TypeError: Dtypes of columns must be Float of Int");
    }
  }

  sub(other, axis) {
    if (this.__frame_is_compactible_for_operation) {
      let tensors = this.__get_ops_tensors([this, other], axis);

      let result = tensors[0].sub(tensors[1]);
      let col_names = this.columns;
      return this.__get_df_from_tensor(result, col_names);
    } else {
      throw Error("TypeError: Dtypes of columns must be Float of Int");
    }
  }

  mul(other, axis) {
    if (this.__frame_is_compactible_for_operation) {
      let tensors = this.__get_ops_tensors([this, other], axis);

      let result = tensors[0].mul(tensors[1]);
      let col_names = this.columns;
      return this.__get_df_from_tensor(result, col_names);
    } else {
      throw Error("TypeError: Dtypes of columns must be Float of Int");
    }
  }

  div(other, axis) {
    if (this.__frame_is_compactible_for_operation) {
      let tensors = this.__get_ops_tensors([this, other], axis);

      let result = tensors[0].div(tensors[1]);
      let col_names = this.columns;
      return this.__get_df_from_tensor(result, col_names);
    } else {
      throw Error("TypeError: Dtypes of columns must be Float of Int");
    }
  }

  pow(other, axis) {
    if (this.__frame_is_compactible_for_operation) {
      let tensors = this.__get_ops_tensors([this, other], axis);

      let result = tensors[0].pow(tensors[1]);
      let col_names = this.columns;
      return this.__get_df_from_tensor(result, col_names);
    } else {
      throw Error("TypeError: Dtypes of columns must be Float of Int");
    }
  }

  mod(other, axis) {
    if (this.__frame_is_compactible_for_operation) {
      let tensors = this.__get_ops_tensors([this, other], axis);

      let result = tensors[0].mod(tensors[1]);
      let col_names = this.columns;
      return this.__get_df_from_tensor(result, col_names);
    } else {
      throw Error("TypeError: Dtypes of columns must be Float of Int");
    }
  }

  mean(axis = 1) {
    if (this.__frame_is_compactible_for_operation) {
      let operands = this.__get_tensor_and_idx(this, axis);

      let tensor_vals = operands[0];
      let idx = operands[1];
      let result = tensor_vals.mean(operands[2]);
      let sf = new _series.Series(result.arraySync(), {
        "index": idx
      });
      return sf;
    } else {
      throw Error("TypeError: Dtypes of columns must be Float of Int");
    }
  }

  median(axis = 1) {
    if (this.__frame_is_compactible_for_operation) {
      let tensor_vals, idx;

      if (axis == 1) {
        tensor_vals = this.col_data_tensor.arraySync();
        idx = this.column_names;
      } else {
        tensor_vals = this.row_data_tensor.arraySync();
        idx = this.index;
      }

      let median = utils.__median(tensor_vals, false);

      let sf = new _series.Series(median, {
        "index": idx
      });
      return sf;
    } else {
      throw Error("TypeError: Dtypes of columns must be Float of Int");
    }
  }

  min(axis = 1) {
    if (this.__frame_is_compactible_for_operation) {
      let operands = this.__get_tensor_and_idx(this, axis);

      let tensor_vals = operands[0];
      let idx = operands[1];
      let result = tensor_vals.min(operands[2]);
      let sf = new _series.Series(result.arraySync(), {
        "index": idx
      });
      return sf;
    } else {
      throw Error("TypeError: Dtypes of columns must be Float of Int");
    }
  }

  max(axis = 1) {
    if (this.__frame_is_compactible_for_operation) {
      let operands = this.__get_tensor_and_idx(this, axis);

      let tensor_vals = operands[0];
      let idx = operands[1];
      let result = tensor_vals.max(operands[2]);
      let sf = new _series.Series(result.arraySync(), {
        "index": idx
      });
      return sf;
    } else {
      throw Error("TypeError: Dtypes of columns must be Float of Int");
    }
  }

  std(axis = 1) {
    if (this.__frame_is_compactible_for_operation) {
      let tensor_vals = this.col_data_tensor.arraySync();
      let idx;

      if (axis == 1) {
        idx = this.column_names;
      } else {
        idx = this.index;
      }

      let median = (0, _mathjs.std)(tensor_vals, axis);
      let sf = new _series.Series(median, {
        "index": idx
      });
      return sf;
    } else {
      throw Error("TypeError: Dtypes of columns must be Float of Int");
    }
  }

  var(axis = 1) {
    if (this.__frame_is_compactible_for_operation) {
      let tensor_vals = this.col_data_tensor.arraySync();
      let idx;

      if (axis == 1) {
        idx = this.column_names;
      } else {
        idx = this.index;
      }

      let median = (0, _mathjs.variance)(tensor_vals, axis);
      let sf = new _series.Series(median, {
        "index": idx
      });
      return sf;
    } else {
      throw Error("TypeError: Dtypes of columns must be Float of Int");
    }
  }

  count(axis = 1) {
    if (this.__frame_is_compactible_for_operation) {
      let tensor_vals, idx;

      if (axis == 1) {
        tensor_vals = this.col_data_tensor.arraySync();
        idx = this.column_names;
      } else {
        tensor_vals = this.row_data_tensor.arraySync();
        idx = this.index;
      }

      let counts = utils.__count_nan(tensor_vals, true, false);

      let sf = new _series.Series(counts, {
        "index": idx
      });
      return sf;
    } else {
      throw Error("TypeError: Dtypes of columns must be Float of Int");
    }
  }

  round(dp = 1) {
    if (this.__frame_is_compactible_for_operation) {
      let values = this.values;
      let idx = this.index;

      let new_vals = utils.__round(values, dp, false);

      let options = {
        "columns": this.column_names,
        "index": idx
      };
      let df = new DataFrame(new_vals, options);
      return df;
    } else {
      throw Error("TypeError: Dtypes of columns must be Float of Int");
    }
  }

  cum_ops(axis = 0, ops) {
    if (!(axis == 0) && !(axis == 1)) {
      throw new Error("axis must be between 0 or 1");
    }

    if (this.__frame_is_compactible_for_operation) {
      let data = [];
      let df_data = null;

      if (axis == 0) {
        df_data = this.col_data;
      } else {
        df_data = this.values;
      }

      for (let i = 0; i < df_data.length; i++) {
        let value = df_data[i];
        let temp_val = value[0];
        let temp_data = [temp_val];

        for (let j = 1; j < value.length; j++) {
          let curr_val = value[j];

          switch (ops) {
            case "max":
              if (curr_val > temp_val) {
                temp_val = curr_val;
                temp_data.push(curr_val);
              } else {
                temp_data.push(temp_val);
              }

              break;

            case "min":
              if (curr_val < temp_val) {
                temp_val = curr_val;
                temp_data.push(curr_val);
              } else {
                temp_data.push(temp_val);
              }

              break;

            case "sum":
              temp_val = temp_val + curr_val;
              temp_data.push(temp_val);
              break;

            case "prod":
              temp_val = temp_val * curr_val;
              temp_data.push(temp_val);
              break;
          }
        }

        data.push(temp_data);
      }

      if (axis == 0) {
        data = utils.__get_col_values(data);
      }

      return new DataFrame(data, {
        columns: this.columns
      });
    } else {
      throw Error("TypeError: Dtypes of columns must be Float of Int");
    }
  }

  cumsum(kwargs = {}) {
    let axis = kwargs["axis"] || 0;
    let data = this.cum_ops(axis, "sum");
    return data;
  }

  cummin(kwargs = {}) {
    let axis = kwargs["axis"] || 0;
    let data = this.cum_ops(axis, "min");
    return data;
  }

  cummax(kwargs = {}) {
    let axis = kwargs["axis"] || 0;
    let data = this.cum_ops(axis, "max");
    return data;
  }

  cumprod(kwargs = {}) {
    let axis = kwargs["axis"] || 0;
    let data = this.cum_ops(axis, "prod");
    return data;
  }

  copy() {
    let df = new DataFrame([...this.values], {
      columns: [...this.column_names],
      index: this.index,
      dtypes: this.dtypes
    });
    return df;
  }

  reset_index(kwargs = {}) {
    let options = {};

    if (utils.__key_in_object(kwargs, 'inplace')) {
      options['inplace'] = kwargs['inplace'];
    } else {
      options['inplace'] = false;
    }

    if (options['inplace']) {
      this.__reset_index();
    } else {
      let df = this.copy();

      df.__reset_index();

      return df;
    }
  }

  set_index(kwargs = {}) {
    let options = {};

    if (utils.__key_in_object(kwargs, 'index')) {
      options['index'] = kwargs['index'];
    } else {
      throw Error("Index ValueError: You must specify an array of index");
    }

    if (utils.__key_in_object(kwargs, 'inplace')) {
      options['inplace'] = kwargs['inplace'];
    } else {
      options['inplace'] = false;
    }

    if (options['index'].length != this.index.length) {
      throw Error(`Index LengthError: Lenght of new Index array ${options['index'].length} must match lenght of existing index ${this.index.length}`);
    }

    if (options['inplace']) {
      this.index_arr = options['index'];
    } else {
      let df = this.copy();

      df.__set_index(options['index']);

      return df;
    }
  }

  describe() {
    let numeric_df = this.select_dtypes(['float32', 'int32']);
    let col_names = numeric_df.columns;
    let index = ['count', 'mean', 'std', 'min', 'median', 'max', 'variance'];
    let stats_arr = [];
    col_names.forEach(name => {
      let col_series = numeric_df.column(name);
      let count = col_series.count();
      let mean = col_series.mean();
      let std = col_series.std();
      let min = col_series.min();
      let median = col_series.median();
      let max = col_series.max();
      let variance = col_series.var();
      let _stats = [count, mean, std, min, median, max, variance];
      let col_obj = {};
      col_obj[name] = _stats;
      stats_arr.push(col_obj);
    });
    let df = new DataFrame(stats_arr, {
      "index": index
    });
    return df.round(6);
  }

  select_dtypes(include = [""]) {
    let dtypes = this.dtypes;
    let col_vals = [];
    let original_col_vals = this.col_data;
    const __supported_dtypes = ['float32', "int32", 'string', 'datetime'];

    if (include == [""] || include == []) {
      let df = this.copy();
      return df;
    } else {
      include.forEach(type => {
        if (!__supported_dtypes.includes(type)) {
          throw Error(`Dtype Error: dtype ${type} not found in dtypes`);
        }

        dtypes.map((dtype, i) => {
          if (dtype == type) {
            let _obj = {};
            _obj[this.column_names[i]] = original_col_vals[i];
            col_vals.push(_obj);
          }
        });
      });

      if (col_vals.length == 1) {
        let _key = Object.keys(col_vals[0])[0];
        let data = col_vals[0][_key];
        let column_name = [_key];
        let sf = new _series.Series(data, {
          columns: column_name,
          index: this.index
        });
        return sf;
      } else {
        let df = new DataFrame(col_vals, {
          index: this.index
        });
        return df;
      }
    }
  }

  sort_values(kwargs = {}) {
    if (utils.__key_in_object(kwargs, "by")) {
      let sort_col = this.column(kwargs["by"]);
      let sorted_col, sorted_index;
      let new_row_data = [];

      if (utils.__key_in_object(kwargs, "inplace") && kwargs['inplace'] == true) {
        sort_col.sort_values(kwargs);
        sorted_index = sort_col.index;
      } else {
        sorted_col = sort_col.sort_values(kwargs);
        sorted_index = sorted_col.index;
      }

      sorted_index.map(idx => {
        new_row_data.push(this.values[idx]);
      });

      if (utils.__key_in_object(kwargs, "inplace") && kwargs['inplace'] == true) {
        this.data = new_row_data;
        this.index_arr = sorted_index;
        return null;
      } else {
        let df = new DataFrame(new_row_data, {
          columns: this.column_names,
          index: sorted_index,
          dtype: this.dtypes
        });
        return df;
      }
    } else {
      throw Error("Value Error: must specify the column to sort by");
    }
  }

  __get_tensor_and_idx(df, axis) {
    let tensor_vals, idx, t_axis;

    if (axis == 1) {
      tensor_vals = df.row_data_tensor;
      idx = df.column_names;
      t_axis = 0;
    } else {
      tensor_vals = df.row_data_tensor;
      idx = df.index;
      t_axis = 1;
    }

    return [tensor_vals, idx, t_axis];
  }

  query(kwargs) {
    let operators = [">", "<", "<=", ">=", "=="];

    if (Object.prototype.hasOwnProperty.call(kwargs, "column")) {
      if (this.columns.includes(kwargs["column"])) {
        var column_index = this.columns.indexOf(kwargs["column"]);
      } else {
        throw new Error(`column ${kwargs["column"]} does not exist`);
      }
    } else {
      throw new Error("specify the column");
    }

    if (Object.prototype.hasOwnProperty.call(kwargs, "operator")) {
      if (operators.includes(kwargs["operator"])) {
        var operator = kwargs["operator"];
      } else {
        throw new Error(` ${kwargs["operator"]} is not identified`);
      }
    } else {
      throw new Error("specify operator");
    }

    if (Object.prototype.hasOwnProperty.call(kwargs, "value")) {
      var value = kwargs["value"];
    } else {
      throw new Error("specify value");
    }

    let data = this.values;
    let new_data = [];

    for (var i = 0; i < data.length; i++) {
      let data_value = data[i];
      let elem = data_value[column_index];

      if (eval(`${elem}${operator}${value}`)) {
        new_data.push(data_value);
      }
    }

    let columns = this.columns;
    let new_df = new DataFrame(new_data, {
      "columns": columns
    });
    return new_df;
  }

  addColumn(kwargs) {
    let data_length = this.shape[0];

    utils.__in_object(kwargs, "column", "column name not specified");

    utils.__in_object(kwargs, "value", "column value not specified");

    let value = kwargs["value"];
    let column_name = kwargs["column"];

    if (value.length != data_length) {
      throw new Error(`Array length ${value.length} not equal to ${data_length}`);
    }

    let data = this.values;
    let new_data = [];
    data.map(function (val, index) {
      let new_val = val.slice();
      new_val.push(value[index]);
      new_data.push(new_val);
    });
    let old_type_list = [...this.dtypes];
    old_type_list.push(utils.__get_t(value)[0]);
    this.col_types = old_type_list;
    this.data = new_data;
    this.col_data = utils.__get_col_values(new_data);
    this.data_tensor = tf.tensor(new_data);
    this.columns.push(column_name);
  }

  groupby(col) {
    let len = this.shape[0] - 1;
    let column_names = this.column_names;
    let col_dict = {};
    let key_column = null;

    if (col.length == 2) {
      if (column_names.includes(col[0])) {
        var [data1, col_name1] = this.__indexLoc({
          "rows": [`0:${len}`],
          "columns": [`${col[0]}`],
          "type": "loc"
        });
      } else {
        throw new Error(`column ${col[0]} does not exist`);
      }

      if (column_names.includes(col[1])) {
        var [data2, col_name2] = this.__indexLoc({
          "rows": [`0:${len}`],
          "columns": [`${col[1]}`],
          "type": "loc"
        });
      } else {
        throw new Error(`column ${col[1]} does not exist`);
      }

      key_column = [col[0], col[1]];

      var column_1_Unique = utils.__unique(data1);

      var column_2_unique = utils.__unique(data2);

      for (var i = 0; i < column_1_Unique.length; i++) {
        let col_value = column_1_Unique[i];
        col_dict[col_value] = {};

        for (var j = 0; j < column_2_unique.length; j++) {
          let col2_value = column_2_unique[j];
          col_dict[col_value][col2_value] = [];
        }
      }
    } else {
      if (column_names.includes(col[0])) {
        var [data1, col_name1] = this.__indexLoc({
          "rows": [`0:${len}`],
          "columns": [`${col[0]}`],
          "type": "loc"
        });
      } else {
        throw new Error(`column ${col[0]} does not exist`);
      }

      key_column = [col[0]];

      var column_Unique = utils.__unique(data1);

      for (let i = 0; i < column_Unique.length; i++) {
        let col_value = column_Unique[i];
        col_dict[col_value] = [];
      }
    }

    let groups = new _groupby.GroupBy(col_dict, key_column, this.values, column_names).group();
    return groups;
  }

  column(col_name) {
    if (!this.columns.includes(col_name)) {
      throw new Error(`column ${col_name} does not exist`);
    }

    let col_indx_objs = utils.__arr_to_obj(this.columns);

    let indx = col_indx_objs[col_name];
    let data = this.col_data[indx];
    return new _series.Series(data, {
      columns: [col_name]
    });
  }

  fillna(nan_val) {
    let data = [];
    let values = this.values;
    let columns = this.columns;

    for (let i = 0; i < values.length; i++) {
      let temp_data = [];
      let row_value = values[i];

      for (let j = 0; j < row_value.length; j++) {
        let val = row_value[j] == 0 ? 0 : !!row_value[j];

        if (!val) {
          temp_data.push(nan_val);
        } else {
          temp_data.push(row_value[j]);
        }
      }

      data.push(temp_data);
    }

    return new DataFrame(data, {
      columns: columns
    });
  }

  isna() {
    let data = [];
    let values = this.values;
    let columns = this.columns;

    for (let i = 0; i < values.length; i++) {
      let temp_data = [];
      let row_value = values[i];

      for (let j = 0; j < row_value.length; j++) {
        let val = row_value[j] == 0 ? 0 : !!row_value[j];
        temp_data.push(val);
      }

      data.push(temp_data);
    }

    return new DataFrame(data, {
      columns: columns
    });
  }

  nanIndex() {
    let df_values = this.values;
    let index_data = [];

    for (let i = 0; i < df_values.length; i++) {
      let row_values = df_values[i];

      if (row_values.includes(NaN)) {
        index_data.push(i);
      }
    }

    return index_data;
  }

  dropna(kwargs = {}) {
    let axis = kwargs["axis"] || 0;
    let inplace = kwargs["inplace"] || false;

    if (axis != 0 && axis != 1) {
      throw new Error("axis must either be 1 or 0");
    }

    let df_values = null;
    let columns = null;

    if (axis == 0) {
      df_values = this.values;
      columns = this.columns;
    } else {
      df_values = this.col_data;
      columns = [];
    }

    let data = [];

    for (let i = 0; i < df_values.length; i++) {
      let values = df_values[i];

      if (!values.includes(NaN)) {
        if (axis == 0) {
          data.push(values);
        } else {
          columns.push(this.columns[i]);

          if (data.length == 0) {
            for (let j = 0; j < values.length; j++) {
              data.push([values[j]]);
            }
          } else {
            for (let j = 0; j < data.length; j++) {
              data[j].push(values[j]);
            }
          }
        }
      }
    }

    if (inplace == true) {
      this.data = data;

      this.__reset_index();

      this.columns = columns;
    } else {
      return new DataFrame(data, {
        columns: columns
      });
    }
  }

  static concat(kwargs) {
    utils.__in_object(kwargs, "df_list", "df_list not found: specify the list of dataframe");

    utils.__in_object(kwargs, "axis", "axis not found: specify the axis");

    let df_list = null;
    let axis = null;

    if (Array.isArray(kwargs["df_list"])) {
      df_list = kwargs["df_list"];
    } else {
      throw new Error("df_list must be an Array of dataFrame");
    }

    if (typeof kwargs["axis"] === "number") {
      if (kwargs["axis"] == 0 || kwargs["axis"] == 1) {
        axis = kwargs["axis"];
      } else {
        throw new Error("Invalid axis: axis must be 0 or 1");
      }
    } else {
      throw new Error("axis must be a number");
    }

    let df_object = Object.assign({}, df_list);

    if (axis == 1) {
      let columns = [];
      let duplicate_col_count = {};
      let max_length = 0;

      for (let key in df_object) {
        let column = df_object[key].columns;
        let length = df_object[key].values.length;

        if (length > max_length) {
          max_length = length;
        }

        for (let index in column) {
          let col_name = column[index];

          if (col_name in duplicate_col_count) {
            let count = duplicate_col_count[col_name];
            let name = `${col_name}_${count + 1}`;
            columns.push(name);
            duplicate_col_count[col_name] = count + 1;
          } else {
            columns.push(col_name);
            duplicate_col_count[col_name] = 1;
          }
        }
      }

      let data = new Array(max_length);

      for (let key in df_list) {
        let values = df_list[key].values;

        for (let index = 0; index < values.length; index++) {
          let val = values[index];

          if (typeof data[index] === "undefined") {
            data[index] = val;
          } else {
            data[index].push(...val);
          }
        }

        if (values.length < max_length) {
          let column_length = df_list[key].columns.length;
          let null_array = Array(column_length);

          for (let col = 0; col < column_length; col++) {
            null_array[col] = NaN;
          }

          if (typeof data[max_length - 1] === "undefined") {
            data[max_length - 1] = null_array;
          } else {
            data[max_length - 1].push(...null_array);
          }
        }
      }

      let df = new DataFrame(data, {
        columns: columns
      });
      return df;
    } else {
      let columns = [];

      for (let key in df_list) {
        let column = df_list[key].columns;
        columns.push(...column);
      }

      let column_set = new Set(columns);
      columns = Array.from(column_set);
      let data = [];

      for (let key in df_list) {
        let value = df_list[key].values;
        let df_columns = df_list[key].columns;
        let not_exist = [];

        for (let col_index in columns) {
          let col_name = columns[col_index];
          let is_index = df_columns.indexOf(col_name);

          if (is_index == -1) {
            not_exist.push(col_name);
          }
        }

        if (not_exist.length > 0) {
          for (let i = 0; i < value.length; i++) {
            let row_value = value[i];
            let new_arr = Array(columns.length);

            for (let j = 0; j < columns.length; j++) {
              let col_name = columns[j];

              if (not_exist.includes(col_name)) {
                new_arr[j] = NaN;
              } else {
                let index = df_columns.indexOf(col_name);
                new_arr[j] = row_value[index];
              }
            }

            data.push(new_arr);
          }
        } else {
          data.push(...value);
        }
      }

      let df = new DataFrame(data, {
        columns: columns
      });
      return df;
    }
  }

  static merge(kwargs) {
    let merge = new _merge.Merge(kwargs);
    return merge;
  }

  apply(kwargs) {
    let is_callable = utils.__is_function(kwargs["callable"]);

    if (!is_callable) {
      throw new Error("the arguement most be a function");
    }

    let callable = kwargs["callable"];
    let data = [];

    if (!(kwargs["axis"] == 0) && !(kwargs["axis"] == 1)) {
      throw new Error("axis must either be 0 or 1");
    }

    let axis = kwargs["axis"];

    if (axis == 1) {
      let df_data = this.values;

      for (let i = 0; i < df_data.length; i++) {
        let row_value = tf.tensor(df_data[i]);
        let callable_data = callable(row_value).arraySync();
        data.push(callable_data);
      }
    } else {
      let df_data = this.col_data;

      for (let i = 0; i < df_data.length; i++) {
        let row_value = tf.tensor(df_data[i]);
        let callable_data = callable(row_value).arraySync();
        data.push(callable_data);
      }
    }

    return data;
  }

  __get_df_from_tensor(val, col_names) {
    let len = val.shape[0];
    let new_array = [];

    for (let i = 0; i < len; i++) {
      let arr = val.slice([i], [1]).arraySync()[0];
      new_array.push(arr);
    }

    return new DataFrame(new_array, {
      columns: col_names
    });
  }

  __frame_is_compactible_for_operation() {
    let dtypes = this.dtypes;

    const float = element => element == "float32";

    const int = element => element == "int32";

    if (dtypes.every(float)) {
      return true;
    } else if (dtypes.every(int)) {
      return true;
    } else {
      return false;
    }
  }

  __get_ops_tensors(tensors, axis) {
    if (utils.__is_undefined(tensors[1].series)) {
      let tensors_arr = [];

      if (utils.__is_undefined(axis) || axis == 1) {
        tensors_arr.push(tensors[0].row_data_tensor);
        tensors_arr.push(tensors[1]);
        return tensors_arr;
      } else {
        tensors_arr.push(tensors[0].col_data_tensor);
        tensors_arr.push(tensors[1]);
        return tensors_arr;
      }
    } else {
      let tensors_arr = [];

      if (utils.__is_undefined(axis) || axis == 1) {
        let this_tensor, other_tensor;
        this_tensor = tensors[0].row_data_tensor;

        if (tensors[1].series) {
          other_tensor = tf.tensor(tensors[1].values, [1, tensors[1].values.length]);
        } else {
          other_tensor = tensors[1].row_data_tensor;
        }

        tensors_arr.push(this_tensor);
        tensors_arr.push(other_tensor);
        return tensors_arr;
      } else {
        let this_tensor, other_tensor;
        this_tensor = tensors[0].row_data_tensor;

        if (tensors[1].series) {
          other_tensor = tf.tensor(tensors[1].values, [tensors[1].values.length, 1]);
        } else {
          other_tensor = tensors[1].row_data_tensor;
        }

        tensors_arr.push(this_tensor);
        tensors_arr.push(other_tensor);
        return tensors_arr;
      }
    }
  }

}

exports.DataFrame = DataFrame;