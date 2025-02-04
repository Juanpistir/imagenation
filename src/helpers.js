import timeago from 'timeago.js';

export const helpers = {
  timeago: (timestamp) => {
    if (!timestamp) return '';
    return timeago.format(timestamp, 'es');
  },
  eq: (a, b) => a === b,
  neq: (a, b) => a !== b,
  lt: (a, b) => a < b,
  gt: (a, b) => a > b,
  lte: (a, b) => a <= b,
  gte: (a, b) => a >= b,
  and: (a, b) => a && b,
  or: (a, b) => a || b,
  not: (a) => !a,
  truncate: (text, maxLength) => {
    if (!text) return '';
    if (text.length > maxLength) {
      return text.substring(0, maxLength) + '...';
    }
    return text;
  },
  formatDate: (date) => {
    console.log('Raw timestamp:', date);
    if (!date) return '';
    
    // Convertir Firebase Timestamp a Date si es necesario
    let dateObj;
    if (date && typeof date === 'object' && date.toDate) {
      dateObj = date.toDate();
    } else {
      dateObj = new Date(date);
    }

    const formatted = dateObj.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    console.log('Formatted date:', formatted);
    return formatted;
  },
  json: (context) => {
    return JSON.stringify(context, null, 2);
  },
  compare: function (lvalue, operator, rvalue, options) {
    if (arguments.length < 3) {
      throw new Error("Handlebars Helper 'compare' needs 2 parameters");
    }

    const operators = {
      '==': function (l, r) {
        return l == r;
      },
      '===': function (l, r) {
        return l === r;
      },
      '!=': function (l, r) {
        return l != r;
      },
      '!==': function (l, r) {
        return l !== r;
      },
      '<': function (l, r) {
        return l < r;
      },
      '>': function (l, r) {
        return l > r;
      },
      '<=': function (l, r) {
        return l <= r;
      },
      '>=': function (l, r) {
        return l >= r;
      },
      typeof: function (l, r) {
        return typeof l == r;
      },
    };

    if (!operators[operator]) {
      throw new Error("Handlebars Helper 'compare' doesn't know the operator " + operator);
    }

    const result = operators[operator](lvalue, rvalue);

    if (result) {
      return options.fn(this);
    } else {
      return options.inverse(this);
    }
  },
  formatNumber: (number) => {
    return new Intl.NumberFormat().format(number);
  },
  includes: (array, value) => {
    if (!Array.isArray(array)) return false;
    return array.includes(value);
  },
  firstChar: (text) => {
    if (!text) return '';
    return text.charAt(0);
  },
};
