import { getCoupons } from "../actions";
import { CouponList } from "./coupon-list";
import { CouponForm } from "./coupon-form";

export const metadata = { title: "Cupons" };

export default async function AdminCuponsPage() {
  const coupons = await getCoupons();

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl text-white">CUPONS</h1>
          <p className="text-gray-2 text-sm mt-1">
            Crie e gerencie cupons de desconto para assinantes.
          </p>
        </div>
        <CouponForm />
      </div>

      <CouponList coupons={coupons} />
    </div>
  );
}
