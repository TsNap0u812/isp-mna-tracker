import { BarChart2 } from 'lucide-react'

export default function AnalyticsPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 p-12">
      <div className="max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-100 mb-5">
          <BarChart2 className="h-8 w-8 text-brand-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Analytics</h2>
        <p className="text-gray-500 text-sm leading-relaxed">
          Charts, trends, and deal statistics coming soon.
        </p>
      </div>
    </div>
  )
}
