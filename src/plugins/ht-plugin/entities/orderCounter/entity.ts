import { Entity, PrimaryGeneratedColumn, Column } from "typeorm"

@Entity()
export class OrderCounter {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    currentValue: number
}
