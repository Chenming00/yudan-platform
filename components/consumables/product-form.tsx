"use client";
import { CircleAlert, CircleCheck, Plus } from "lucide-react";
import { useActionState } from "react";
import { createProductAction, type ConsumablesFormState } from "@/app/(platform)/consumables/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
const initial: ConsumablesFormState = { status: "idle" };
export function ProductForm() { const [state, action, pending] = useActionState(createProductAction, initial); return <form action={action} className="space-y-4">{state.status !== "idle" ? <Alert variant={state.status === "error" ? "destructive" : "default"}>{state.status === "error" ? <CircleAlert /> : <CircleCheck />}<AlertDescription>{state.message}</AlertDescription></Alert> : null}<div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="product-name">名称</Label><Input id="product-name" name="name" required /></div><div className="grid gap-2"><Label htmlFor="product-category">分类</Label><Input id="product-category" name="category" required /></div><div className="grid gap-2"><Label htmlFor="product-unit">单位</Label><Input id="product-unit" name="unit" placeholder="包、瓶、盒…" required /></div><div className="grid gap-2"><Label htmlFor="product-min">安全库存</Label><Input defaultValue="2" id="product-min" min="0" name="minStock" required type="number" /></div><div className="grid gap-2"><Label htmlFor="product-spec">规格</Label><Input id="product-spec" name="spec" /></div><div className="grid gap-2"><Label htmlFor="product-barcode">条码</Label><Input id="product-barcode" name="barcode" /></div></div><Button disabled={pending} type="submit"><Plus />{pending ? "创建中…" : "创建产品"}</Button></form>; }
