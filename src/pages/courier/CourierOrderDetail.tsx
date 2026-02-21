import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  MapPin,
  Package,
  CheckCircle,
  Truck,
  Clock,
  Navigation
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/utils/cn';
import { Badge, getStatusBadgeVariant, getStatusLabel } from '@/components/ui/Badge';
import { useOrderStore } from '@/stores/useOrderStore';
import { useAuth } from '@/context/AuthContext';
import { useCourierStore } from '@/stores/useCourierStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useUserStore } from '@/stores/useUserStore';
import { OrderStatus } from '@/types';

export function CourierOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { orders, updateOrderStatus } = useOrderStore();
  const { user } = useAuth();
  const { couriers } = useCourierStore();
  const { users } = useUserStore();
  const { user: currentUser } = useSessionStore();
  const [isUpdating, setIsUpdating] = useState(false);

  // Real-time suspended check from useUserStore
  const liveUser = users.find(u => u.id === currentUser?.id);
  const isSuspended = liveUser?.is_active === false;

  const currentCourier = useMemo(() => couriers.find(c => c.id === user?.id), [couriers, user]);
  const commissionRate = currentCourier?.commission_rate ?? 80;

  const order = useMemo(() => orders.find(o => o.id === id), [orders, id]);

  if (!order) {
    return <div className="p-8 text-center">Order not found</div>;
  }

  const statusFlow: OrderStatus[] = ['assigned', 'picked_up', 'in_transit', 'delivered'];

  const getNextStatus = (): OrderStatus | null => {
    const currentIndex = statusFlow.indexOf(order.status);
    if (currentIndex !== -1 && currentIndex < statusFlow.length - 1) {
      return statusFlow[currentIndex + 1];
    }
    return null;
  };

  const getNextStatusButton = () => {
    const nextStatus = getNextStatus();
    switch (nextStatus) {
      case 'picked_up':
        return { label: 'Pick Up Order', color: 'bg-blue-600 hover:bg-blue-700' };
      case 'in_transit':
        return { label: 'Start Delivery', color: 'bg-orange-600 hover:bg-orange-700' };
      case 'delivered':
        return { label: 'Mark as Delivered', color: 'bg-green-600 hover:bg-green-700' };
      default:
        return null; // No action for other statuses or if finished
    }
  };

  const handleUpdateStatus = async () => {
    const nextStatus = getNextStatus();
    if (!nextStatus) return;

    setIsUpdating(true);
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    updateOrderStatus(order.id, nextStatus, user?.id || "0" as string, user?.name || 'Courier');
    setIsUpdating(false);

    if (nextStatus === 'delivered') {
      setTimeout(() => {
        navigate('/courier/orders');
      }, 1500);
    }
  };

  const handleCallCustomer = () => {
    window.location.href = `tel:${order.customer_phone}`;
  };

  const handleOpenMaps = () => {
    const encodedAddress = encodeURIComponent(order.customer_address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
  };

  const nextStatusButton = getNextStatusButton();

  const statusSteps = [
    { status: 'assigned', label: 'Assigned', icon: Package },
    { status: 'picked_up', label: 'Picked Up', icon: CheckCircle },
    { status: 'in_transit', label: 'On The Way', icon: Truck },
    { status: 'delivered', label: 'Delivered', icon: CheckCircle },
  ];

  // We need to map order status to these steps index
  // Note: 'pending' or 'cancelled' might be edge cases, but for Courier view, it usually starts at 'assigned'.
  // If cancelled, show cancelled state?
  const currentStepIndex = statusFlow.indexOf(order.status);

  if (order.status === 'cancelled') {
    return (
      <div className="p-4 space-y-4">
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-center">
          <h1 className="text-red-700 font-bold text-lg">Order Cancelled</h1>
          <p className="text-red-600 mt-2">{order.cancellation_reason || 'This order has been cancelled.'}</p>
          <button onClick={() => navigate(-1)} className="mt-4 text-sm font-medium underline">Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 -mx-4 -mt-6">
      {/* Header */}
      <div className="bg-green-600 text-white px-4 pt-4 pb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/80 hover:text-white mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-100 text-sm">Order Number</p>
            <h1 className="text-xl font-bold">{order.order_number}</h1>
          </div>
          <Badge
            variant={getStatusBadgeVariant(order.status)}
            size="md"
            className="bg-white/20 text-white"
          >
            {getStatusLabel(order.status)}
          </Badge>
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* Status Timeline */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">Order Status</h3>
          <div className="flex items-center justify-between">
            {statusSteps.map((step, index) => {
              const StepIcon = step.icon;
              const isCompleted = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;

              return (
                <div key={step.status} className="flex flex-col items-center flex-1">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-colors",
                      isCompleted
                        ? isCurrent
                          ? "bg-green-600 text-white"
                          : "bg-green-100 text-green-600"
                        : "bg-gray-100 text-gray-400"
                    )}
                  >
                    <StepIcon className="h-5 w-5" />
                  </div>
                  <p className={cn(
                    "text-xs text-center",
                    isCompleted ? "text-green-600 font-medium" : "text-gray-400"
                  )}>
                    {step.label}
                  </p>
                  {index < statusSteps.length - 1 && (
                    <div className={cn(
                      "absolute h-0.5 w-1/4",
                      index < currentStepIndex ? "bg-green-600" : "bg-gray-200"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Customer Info */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">Customer Information</h3>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-lg font-bold text-gray-600">
                  {order.customer_name.charAt(0)}
                </span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{order.customer_name}</p>
                <p className="text-sm text-gray-500">{order.customer_phone}</p>
              </div>
              <button
                onClick={handleCallCustomer}
                className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 hover:bg-green-200 transition-colors"
              >
                <Phone className="h-5 w-5" />
              </button>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Delivery Address</p>
                  <p className="text-sm text-gray-600 mt-1">{order.customer_address}</p>
                </div>
              </div>
              <button
                onClick={handleOpenMaps}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium text-sm hover:bg-blue-100 transition-colors"
              >
                <Navigation className="h-4 w-4" />
                Open in Maps
              </button>
            </div>
          </div>
        </div>

        {/* Order Details */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">Order Details</h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Order Fee</span>
              <span className="font-semibold text-gray-900">
                Rp {(order.total_fee || 0).toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Your Earnings ({commissionRate}%)</span>
              <span className="font-semibold text-green-600">
                Rp {((order.total_fee || 0) * (commissionRate / 100)).toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Order Time</span>
              <span className="text-sm text-gray-900">
                {order.created_at ? format(parseISO(order.created_at), 'MMM dd, HH:mm') : '-'}
              </span>
            </div>
            {order.estimated_delivery_time && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Est. Delivery</span>
                <span className="text-sm text-gray-900 flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {format(parseISO(order.estimated_delivery_time), 'HH:mm')}
                </span>
              </div>
            )}
          </div>

          {/* Notes field not available in Order type yet? Assuming it is or I should modify types if needed.
              Current Order type doesn't have notes. I will omit or assume I should add it.
              For now I'll comment it out or show empty if I don't see it in type definition.
              Looking at useOrderStore mock data, there is no notes field.
              I will assume no notes for now.
           */}
          {/* 
            {order.notes && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-900 bg-yellow-50 p-3 rounded-lg">
                    {order.notes}
                </p>
                </div>
            )}
            */}
        </div>

        {/* Action Button */}
        {isSuspended ? (
          <div className="w-full py-4 px-4 rounded-xl bg-red-50 border border-red-200 text-center">
            <p className="text-red-600 font-medium">
              Akun Anda sedang disuspend.
            </p>
            <p className="text-red-400 text-sm mt-1">
              Hubungi admin untuk informasi lebih lanjut.
            </p>
          </div>
        ) : (
          nextStatusButton && order.status !== 'delivered' && (
            <button
              onClick={handleUpdateStatus}
              disabled={isUpdating}
              className={cn(
                "w-full py-4 rounded-xl font-semibold text-white text-lg transition-all",
                nextStatusButton.color,
                isUpdating && "opacity-70 cursor-not-allowed"
              )}
            >
              {isUpdating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Updating...
                </span>
              ) : (
                nextStatusButton.label
              )}
            </button>
          )
        )}

        {order.status === 'delivered' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-2" />
            <p className="font-semibold text-green-800">Order Delivered!</p>
            <p className="text-sm text-green-600 mt-1">
              Great job! You earned Rp {((order.total_fee || 0) * (commissionRate / 100)).toLocaleString('id-ID')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
