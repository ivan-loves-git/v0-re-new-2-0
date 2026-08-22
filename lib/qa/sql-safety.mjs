const TRANSACTION_CONTROL = /^(?:BEGIN(?:\s+(?:WORK|TRANSACTION))?|START\s+TRANSACTION|COMMIT|END(?:\s+(?:WORK|TRANSACTION))?|ROLLBACK|ABORT|SAVEPOINT|RELEASE(?:\s+SAVEPOINT)?|PREPARE\s+TRANSACTION|SET\s+TRANSACTION)\b/i

function stripQuotedAndCommentedSql(sql) {
  let result = ""
  let index = 0
  let blockDepth = 0
  while (index < sql.length) {
    if (blockDepth > 0) {
      if (sql.startsWith("/*", index)) {
        blockDepth += 1
        result += "  "
        index += 2
      } else if (sql.startsWith("*/", index)) {
        blockDepth -= 1
        result += "  "
        index += 2
      } else {
        result += sql[index] === "\n" ? "\n" : " "
        index += 1
      }
      continue
    }
    if (sql.startsWith("--", index)) {
      const end = sql.indexOf("\n", index + 2)
      const length = (end === -1 ? sql.length : end) - index
      result += " ".repeat(length)
      index += length
      continue
    }
    if (sql.startsWith("/*", index)) {
      blockDepth = 1
      result += "  "
      index += 2
      continue
    }
    if (sql[index] === "'" || sql[index] === '"') {
      const quote = sql[index]
      result += " "
      index += 1
      while (index < sql.length) {
        if (sql[index] === quote && sql[index + 1] === quote) {
          result += "  "
          index += 2
        } else if (sql[index] === quote) {
          result += " "
          index += 1
          break
        } else {
          result += sql[index] === "\n" ? "\n" : " "
          index += 1
        }
      }
      continue
    }
    if (sql[index] === "$") {
      const delimiter = sql.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/)?.[0]
      if (delimiter) {
        const end = sql.indexOf(delimiter, index + delimiter.length)
        if (end === -1) throw new Error("QA SQL safety failed: unterminated-dollar-quote")
        const length = end + delimiter.length - index
        const hidden = sql.slice(index, index + length)
        result += hidden.replace(/[^\n]/g, " ")
        index += length
        continue
      }
    }
    result += sql[index]
    index += 1
  }
  if (blockDepth !== 0) throw new Error("QA SQL safety failed: unterminated-comment")
  return result
}

export function assertNoTopLevelTransactionControl(sql) {
  const visible = stripQuotedAndCommentedSql(String(sql))
  for (const statement of visible.split(";")) {
    if (TRANSACTION_CONTROL.test(statement.trimStart())) {
      throw new Error("QA SQL safety failed: transaction-control")
    }
  }
}
