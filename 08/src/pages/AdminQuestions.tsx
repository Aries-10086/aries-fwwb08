import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { fileToTabularText } from '@/utils/spreadsheet'
import { useAuthStore } from '@/store/auth'
import {
  ArrowsClockwise,
  ArrowRight,
  CheckSquare,
  Circle,
  ListChecks,
  UploadSimple,
} from '@phosphor-icons/react'

type QuestionType = 'single' | 'multiple' | 'tf'

type Question = {
  id: string
  type: QuestionType
  category: string
  stem: string
  options: unknown
  answerKey: unknown
  updatedAt: string
}

const TYPE_ENTRIES: Array<{
  type: QuestionType
  label: string
  desc: string
  icon: typeof Circle
  to: string
}> = [
  {
    type: 'single',
    label: '单选题',
    desc: '四选一，考察概念辨析与最优做法',
    icon: Circle,
    to: '/admin/questions/single',
  },
  {
    type: 'tf',
    label: '判断题',
    desc: '正误判断，考察纪律边界与原则表述',
    icon: CheckSquare,
    to: '/admin/questions/tf',
  },
  {
    type: 'multiple',
    label: '多选题',
    desc: '多项组合，考察流程环节与综合判断',
    icon: ListChecks,
    to: '/admin/questions/multiple',
  },
]

export default function AdminQuestions() {
  const nav = useNavigate()
  const { user } = useAuthStore()
  const [items, setItems] = useState<Question[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importFileName, setImportFileName] = useState('')
  const [importText, setImportText] = useState(
    'type,category,stem,optionsJson,answerKeyJson\nsingle,党史,中国共产党成立于哪一年?,"[{""key"":""A"",""text"":""1921""},{""key"":""B"",""text"":""1949""}]",""A""',
  )

  const grouped = useMemo(() => {
    const map: Record<QuestionType, Question[]> = { single: [], tf: [], multiple: [] }
    for (const q of items) map[q.type].push(q)
    return map
  }, [items])

  useEffect(() => {
    if (!user) nav('/login')
    if (user && user.role !== 'admin') nav('/m/home')
  }, [nav, user])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<Question[]>('/api/questions')
      setItems(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function importBatch() {
    setImporting(true)
    setError(null)
    try {
      await apiFetch('/api/questions/import', {
        method: 'POST',
        body: JSON.stringify({ csvText: importText }),
      })
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '导入失败')
    } finally {
      setImporting(false)
    }
  }

  async function onImportFile(file: File | null) {
    if (!file) return
    setError(null)
    try {
      const text = await fileToTabularText(file)
      setImportText(text)
      setImportFileName(file.name)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '文件解析失败')
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="page-eyebrow">管理后台</div>
          <h1 className="page-title text-3xl md:text-4xl">题库管理</h1>
          <div className="page-subtitle mt-2 max-w-2xl">
            按题型分别维护单选、判断与多选，避免所有题目挤在同一列表
          </div>
        </div>
        <Button variant="ghost" onClick={() => void load()} disabled={loading}>
          <ArrowsClockwise className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          刷新
        </Button>
      </div>

      {error && (
        <div className="rounded-2xl bg-[rgba(158,27,43,0.08)] px-4 py-3 text-[#741220] shadow-[inset_0_0_0_1px_rgba(158,27,43,0.16)]">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {TYPE_ENTRIES.map((entry) => {
          const Icon = entry.icon
          const list = grouped[entry.type]
          const preview = list[0]
          return (
            <Link key={entry.type} to={entry.to} className="group block">
              <Card className="h-full transition group-hover:border-[rgba(158,27,43,0.2)]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-[#9e1b2b]" weight="duotone" />
                    {entry.label}
                    <span className="ml-auto rounded-full bg-[rgba(158,27,43,0.08)] px-2.5 py-0.5 text-xs font-semibold text-[#9e1b2b]">
                      {list.length} 题
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-[rgba(18,21,28,0.62)]">{entry.desc}</p>
                  {preview ? (
                    <div className="mt-4 rounded-xl bg-white/90 px-4 py-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
                      <div className="text-xs text-zinc-500">{preview.category}</div>
                      <div className="mt-1 line-clamp-2 text-sm text-[#12151c]">{preview.stem}</div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl bg-white/90 px-4 py-6 text-center text-sm text-zinc-400 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
                      暂无题目
                    </div>
                  )}
                  <div className="mt-4 flex items-center gap-1 text-sm font-medium text-[#9e1b2b]">
                    进入管理
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UploadSimple className="h-5 w-5 text-[#9e1b2b]" />
            题库批量导入
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            <div className="text-xs text-[rgba(18,21,28,0.55)]">
              支持 CSV 或从 Excel 复制粘贴的制表符内容。字段：type、category、stem、optionsJson、answerKeyJson，其中后两项需为合法 JSON。导入后可在对应题型页面查看与编辑。
            </div>
            <label className="grid gap-2 text-sm">
              <span className="field-label">上传文件（.xlsx/.xls/.csv）</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                onChange={async (e) => {
                  await onImportFile(e.target.files?.[0] ?? null)
                  e.currentTarget.value = ''
                }}
                className="input-shell cursor-pointer file:mr-3 file:rounded-full file:border-0 file:bg-[#9e1b2b] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
              />
              {importFileName ? <div className="text-xs text-[rgba(18,21,28,0.55)]">已载入：{importFileName}</div> : null}
            </label>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={5}
              className="input-shell w-full resize-none px-4 py-3 font-mono text-xs text-black/80"
            />
            <div>
              <Button onClick={() => void importBatch()} disabled={!importText.trim() || importing}>
                <UploadSimple className="h-4 w-4" />
                {importing ? '导入中…' : '执行导入'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
