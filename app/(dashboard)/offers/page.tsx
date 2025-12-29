import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function OffersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-gray-900">Offers</h1>
        <p className="text-gray-600 mt-1">Review and manage business offers</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Offer Management</CardTitle>
          <CardDescription>Track submitted and pending offers</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">Offer management features will be added here.</p>
        </CardContent>
      </Card>
    </div>
  )
}
