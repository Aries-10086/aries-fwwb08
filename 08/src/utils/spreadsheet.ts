import * as XLSX from 'xlsx'

export async function fileToTabularText(file: File): Promise<string> {
  const lowerName = file.name.toLowerCase()

  if (lowerName.endsWith('.csv') || lowerName.endsWith('.txt')) {
    return await file.text()
  }

  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    if (!firstSheetName) {
      throw new Error('Excel 文件中没有可读取的工作表')
    }

    const sheet = workbook.Sheets[firstSheetName]
    return XLSX.utils.sheet_to_csv(sheet, {
      FS: '\t',
      RS: '\n',
      blankrows: false,
    })
  }

  throw new Error('仅支持 .xlsx、.xls、.csv、.txt 文件')
}
